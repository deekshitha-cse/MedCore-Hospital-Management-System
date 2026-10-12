import { IsEmail, IsOptional, IsPassportNumber, IsPhoneNumber, IsString, IsUUID, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsPhoneNumber()
  phone: string;

  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}