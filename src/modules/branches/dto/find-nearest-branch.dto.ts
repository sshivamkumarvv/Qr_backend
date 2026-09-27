import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class FindNearestBranchDto {
  @IsUUID()
  restaurantId!: string;

  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;
}

export class ListBranchesQueryDto {
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;
}