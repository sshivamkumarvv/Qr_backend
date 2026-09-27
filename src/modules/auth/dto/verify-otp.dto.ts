
import { IsOptional, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'phone must be a valid phone number, e.g. +919876543210',
  })
  phone!: string;

  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;

  // Only used the first time a phone number verifies (i.e. account creation)
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
@IsString()
deviceId?: string;

@IsOptional()
@IsString()
deviceName?: string;

@IsOptional()
@IsString()
platform?: string;

@IsOptional()
@IsString()
appVersion?: string;

@IsOptional()
@IsString()
pushToken?: string;
}
