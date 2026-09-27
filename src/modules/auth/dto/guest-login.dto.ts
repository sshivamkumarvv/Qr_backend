import { IsOptional, IsString, Matches } from 'class-validator';

export class GuestLoginDto {
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'phone must be a valid phone number, e.g. +919876543210',
  })
  phone!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
