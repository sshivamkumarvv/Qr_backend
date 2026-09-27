import { Matches } from 'class-validator';

export class SendOtpDto {
  // E.164-ish: optional leading +, 8-15 digits, no leading 0
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'phone must be a valid phone number, e.g. +919876543210',
  })
  phone!: string;
}