import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ResolveTableDto {
  // From a QR scan.
  @IsOptional()
  @IsString()
  token?: string;

  // Manual-entry alternative to token — both required together.
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  tableNumber?: string;

  // Customer's current device location. Optional here (this endpoint is
  // used for an early "does this look right" preview), but required and
  // strictly enforced when actually placing the order — see
  // TablesService.assertCustomerAtBranch.
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
