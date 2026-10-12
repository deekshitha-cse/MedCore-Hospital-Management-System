import { ConflictException, Injectable, UnauthorizedException, NotFoundException, Inject } from "@nestjs/common";
import { RegisterDto } from "./dto/register.dto";
import { PrismaService } from "../database/prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { Role } from "../generated/prisma/enums";
import { LoginDto } from "./dto/login.dto";
import { JwtService } from "@nestjs/jwt";
import { REDIS_CLIENT } from "../infrastructure/redis/redis.module";
import Redis from "ioredis";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { EmailService } from "../notifications/email/email.service";
import * as crypto from "crypto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { SmsDto } from "./dto/sms.dto";
import { VerifySmsDto } from "./dto/verify-sms";
import { SmsService } from "../notifications/sms/sms.service";

@Injectable()
export class AuthService {

    constructor(
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
        @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
        private readonly emailService: EmailService,
        private readonly smsService: SmsService,
    ) {}

    private async generateRefreshToken(userId: string, deviceId: string) {
        return this.jwtService.signAsync({
            sub: userId,
            deviceId: deviceId,
        }, {
            secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d'
        })
    }

    async register(registerDto: RegisterDto) {
        if(await this.prismaService.user.findUnique({
            where: {
                email: registerDto.email
            }
        })) {
            throw new ConflictException("Email already registered");
        };



        const hash = await bcrypt.hash(registerDto.password, 12);

        return await this.prismaService.user.create({
            data: {
                name: registerDto.name,
                email: registerDto.email,
                hashPassword: hash,
                role: Role.PATIENT,
                phone: registerDto.phone,
                hospitalId: registerDto.hospitalId
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            }
        });
    }

    async login(loginDto: LoginDto) {
        const user = await this.prismaService.user.findUnique({
            where: {
                email: loginDto.email
            }
        });
        
        if(!user) {
            throw new UnauthorizedException("Invalid Credentials");
        }

        if(!await bcrypt.compare(loginDto.password, user.hashPassword)) {
            throw new UnauthorizedException("Invalid Credentials");
        }
        
        const accessToken = await this.jwtService.signAsync({
            sub: user.id,
            role: user.role,
        })

        const refreshToken = await this.generateRefreshToken(user.id, loginDto.deviceId);

        await this.redisClient.set(`rt:${user.id}:${loginDto.deviceId}`, refreshToken, 'EX', 7*24*60*60,);

        return { accessToken, refreshToken}
    }

    async user(userId: string) {
        return await this.prismaService.user.findUnique({
            where: {
                id: userId
            },
            select: {
                id: true,
                name: true,
                role: true,
                email: true,
                hospitalId: true
            }
        });
        // TODO: handle case where user no longer exists (relevant once deletion is implemented)
    }

    async refresh(refreshToken: string) {
        if(!refreshToken) {
            throw new UnauthorizedException("Invalid Credentials");
        }

       try {
            const payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET,
            });

            if(!await this.redisClient.get(`rt:${payload.sub}:${payload.deviceId}`)) {
                throw new UnauthorizedException("Invalid Credentials")
            }

            const user = await this.prismaService.user.findUnique({
                where: {
                    id: payload.sub
                },
            });

            if (!user) {
                throw new UnauthorizedException('Invalid Credentials');
            }

            const accessToken = await this.jwtService.signAsync({
                sub: user.id,
                role: user.role,
            });

            return { accessToken };
            
       } catch {
        throw new UnauthorizedException("Invalid Credentials");
       }
    }

    async delAllDevices(id: string) {
        const stream = this.redisClient.scanStream({
            match: `rt:${id}:*`,
            count: 100,
        });

        for await (const keys of stream) {
            if(keys.length) {
                await this.redisClient.del(...keys);
            }
        }
    }

    async logout(userId: string, deviceId: string) {
        await this.redisClient.del(`rt:${userId}:${deviceId}`);
    }

    async logoutAll(userId: string) {
        await this.delAllDevices(userId);
    }

    async forgotPassword(forgotEmail: string){
        const user = await this.prismaService.user.findUnique({
            where: {
                email: forgotEmail,
            }
        });

        if(user) {
            const token = crypto.randomBytes(32).toString('hex');
            await this.redisClient.set(`reset:${token}`, user.id, "EX", 15*60)
            try {
                await this.emailService.sendPasswordResetEmail(forgotEmail, `https://medcore-hms.com/reset-password?token=${token}`);
            } catch (error) {
                console.error("Failed to send password reset email:", error);
            }
        }

        return "If an account with that email exists, we've sent a reset link";
    }

    async resetPassword(resetPasswordDto: ResetPasswordDto) {
        const resetUserId = await this.redisClient.getdel(`reset:${resetPasswordDto.token}`)
        if(!resetUserId) {
            throw new UnauthorizedException("Reset link is invalid or expired");
        }

        const user = await this.prismaService.user.findUnique({
            where: {
                id: resetUserId,
            }
        })

        if(!user) {
            throw new NotFoundException("User not found");
        }

        const newPassword = await bcrypt.hash(resetPasswordDto.newPassword, 12);
        await this.prismaService.user.update({
            where: {
                id: resetUserId,
            }, data: {
                hashPassword: newPassword,
            }
        })
        
        await this.delAllDevices(resetUserId);

        return "Your password has been changed successfully";
    }

    async verifyEmail(verifyEmailDto: VerifyEmailDto) {
        const code = await this.redisClient.get(`verify:${verifyEmailDto.email}`);

        if(!code || code !== verifyEmailDto.otp) {
            throw new UnauthorizedException("Invalid or Expired code");
        }

        await this.prismaService.user.update({
            where: {
                email: verifyEmailDto.email,
            }, data: {
                isEmailVerified: true,
            }
        });

        await this.redisClient.del(`verify:${verifyEmailDto.email}`);

        return "Your email has been verified successfully";
    }

    async resendVerification(verifyEmail: string) {
        const user = await this.prismaService.user.findUnique({
            where: {
                email: verifyEmail,
            }
        });

        if(user) {
            const otp = crypto.randomInt(0, 1000000).toString().padStart(6,'0');
            await this.redisClient.set(`verify:${verifyEmail}`, otp, "EX", 10*60)
            try {
                await this.emailService.sendVerificationEmail(verifyEmail, otp);
            } catch (error) {
                console.error("Failed to send verification code email:", error);
            }
        }

        return "If an account with that email exists, we've sent a verification code";

    }

    async phoneVerification(smsDto: SmsDto) {
        const user = await this.prismaService.user.findUnique({
            where: { phone: smsDto.phone },
        });

        if (!user) {
            return {
                message: "If an account with that phone number exists, a verification code has been requested.",
            };
        }

        if (user.isPhoneVerified) {
            return { message: "Phone number is already verified." };
        }

        await this.smsService.sendVerificationSms(smsDto.phone);

        return {
            message: "If an account with that phone number exists, a verification code has been requested.",
        };
    }

    async verifySms(verifySmsDto: VerifySmsDto) {
        const { phone, otp } = verifySmsDto;

        const user = await this.prismaService.user.findUnique({
            where: { phone },
        });

        if (!user) {
            return { verified: false, message: "Invalid phone number or code." };
        }

        if (user.isPhoneVerified) {
            return { verified: true, message: "Phone number is already verified." };
        }

        const isApproved = await this.smsService.checkVerificationCode(
            phone,
            otp,
        );

        if (!isApproved) {
            return { verified: false, message: "Invalid or expired verification code." };
        }

        await this.prismaService.user.update({
            where: { id: user.id },
            data: { isPhoneVerified: true },
        });

        return { verified: true, message: "Phone number verified successfully." };  
    }
}