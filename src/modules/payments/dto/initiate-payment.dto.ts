import { IsOptional, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @IsOptional()
  @IsString()
  provider?: string; // 'phonepe' | 'razorpay'

  @IsOptional()
  @IsString()
  redirectUrl?: string;

  @IsOptional()
  @IsString()
  targetApp?: string;
}
