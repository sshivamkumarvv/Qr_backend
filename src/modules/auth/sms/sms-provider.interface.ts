export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface SmsProvider {
  /**
   * Send an SMS containing the given OTP code to the given phone number.
   * Swap the ConsoleSmsProvider binding in AuthModule for a real provider
   * (Twilio, MSG91, Fast2SMS, AWS SNS, etc.) when you're ready to go live.
   */
  sendOtp(phone: string, code: string): Promise<void>;
}
