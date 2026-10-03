import { IsOptional, IsString } from 'class-validator';

export class PhonePeCreateDto {
  @IsOptional()
  @IsString()
  redirectUrl?: string;

  @IsOptional()
  @IsString()
  targetApp?: string; // 'PHONEPE' | 'GPAY' | 'PAYTM' | 'ANY'
}
