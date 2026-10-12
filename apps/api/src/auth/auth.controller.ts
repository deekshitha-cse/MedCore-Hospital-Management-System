import type { Response } from "express";
import { Controller, UseGuards, Get, Post, Body, Res} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user";
import type { AuthenticatedUser } from "./types/jwt-user.type";
import { RefreshToken } from "./decorators/refrest-token";
import { LogoutDto } from "./dto/logout.dto";
import {ResetPasswordDto } from "./dto/reset-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { EmailDto } from "./dto/email.dto";
import { SmsDto } from "./dto/sms.dto";
import { VerifySmsDto } from "./dto/verify-sms";

@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post("register")
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post("login")
    async login(
        @Body() loginDto: LoginDto, 
        @Res({ passthrough: true }) res: Response,
    ) {
        const {accessToken, refreshToken} = await this.authService.login(loginDto);

        // secure: true — tells the browser "only ever send this cookie over HTTPS, never plain HTTP." In local development without HTTPS set up, this can actually prevent the cookie from being set at all, something to watch for once you test, you may need secure: process.env.NODE_ENV === 'production' instead, so it's relaxed locally but strict in production.

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return { accessToken };
    }

    @UseGuards(JwtAuthGuard)
    @Get("me")
    async user(@CurrentUser() currentUser: AuthenticatedUser) {
        return this.authService.user(currentUser.userId);
    }

    @Post("refresh")
    async refresh(@RefreshToken() refreshToken: string) {
        return this.authService.refresh(refreshToken);
    }

    @UseGuards(JwtAuthGuard)
    @Post("logout") 
    async logout(@Body() logoutDto: LogoutDto, @CurrentUser() currentUser: AuthenticatedUser) {
        return this.authService.logout(currentUser.userId, logoutDto.deviceId);
    }

    @UseGuards(JwtAuthGuard)
    @Post("logout-all")
    async LogoutAll(@CurrentUser() currentUser: AuthenticatedUser) {
        return this.authService.logoutAll(currentUser.userId);
    }

    @Post("forgot-password")
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.authService.forgotPassword(forgotPasswordDto.email);
    }

    @Post("reset-password")
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        return this.authService.resetPassword(resetPasswordDto)
    }

    @Post("verify-email")
    async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
        return this.authService.verifyEmail(verifyEmailDto);
    }

    @Post("verify-phone")
    async verifySms(@Body() verifySms: VerifySmsDto) {
        return this.authService.verifySms(verifySms);
    }

    @Post("resend-verification")
    async resendVerification(@Body() emailDto: EmailDto) {
        return this.authService.resendVerification(emailDto.email)
    }

    @Post("phone-verification")
    async phoneVerification(@Body() smsDto: SmsDto) {
        return this.authService.phoneVerification(smsDto);
    }
}