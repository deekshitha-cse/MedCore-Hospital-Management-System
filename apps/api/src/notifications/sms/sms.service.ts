import { Injectable } from "@nestjs/common";
import { Twilio } from "twilio";

@Injectable()
export class SmsService {
  private readonly client: Twilio;

  constructor() {
    this.client = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async sendVerificationSms(to: string) {
    return this.client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({
        to,
        channel: "sms",
      });
  }

  async checkVerificationCode(to: string, code: string) {
    const result = await this.client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({
        to,
        code,
      });

    return result.status === "approved";
  }
}