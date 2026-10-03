import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RefundPaymentDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number; // Optional partial refund amount in Rupees; if omitted, full order amount is refunded

  @IsOptional()
  @IsString()
  reason?: string;
}
