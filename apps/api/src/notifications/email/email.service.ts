import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.EMAIL_PROVIDER_API_KEY);
  }

  async sendPasswordResetEmail(to: string, resetLink: string) {
    const { data, error } = await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject: 'Reset your password',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 15 minutes.</p>`,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  }

  async sendVerificationEmail(to: string, otp: string) {
    const { data, error} = await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject: 'Verify your email',
      html: 
        `<p>Your verification code is <strong>${otp}</strong>.</p>
        <p>It expires in 10 minutes. If you didn't create an account, you can ignore this email.</p>`,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  }
}