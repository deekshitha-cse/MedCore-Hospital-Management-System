import { IsPhoneNumber } from "class-validator";

export class SmsDto {
    @IsPhoneNumber()
    phone: string;
}