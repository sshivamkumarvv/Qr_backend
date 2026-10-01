import { IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyUpiPaymentDto {
  @IsUUID()
  orderId!: string;

  @IsOptional()
  @IsString()
  transactionRef?: string;

  @IsOptional()
  @IsString()
  utr?: string;

  @IsOptional()
  @IsString()
  upiApp?: string;
}
