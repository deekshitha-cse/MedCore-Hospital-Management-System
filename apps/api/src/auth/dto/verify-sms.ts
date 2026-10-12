import { IsPhoneNumber, IsString, Length, Matches } from "class-validator";

export class VerifySmsDto {
    @IsPhoneNumber()
    phone: string;

    @IsString()
    @Length(6, 6)
    @Matches(/^\d{6}$/)
    otp: string;
}