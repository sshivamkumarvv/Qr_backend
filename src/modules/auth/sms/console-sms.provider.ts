import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

/**
 * Development-only stand-in for a real SMS gateway. Logs the OTP instead of
 * sending a text message, so you can test the full flow locally with zero
 * external dependencies. Replace this with a real provider before shipping.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP for ${phone}: ${code} (valid for 5 minutes)`);
  }
}
