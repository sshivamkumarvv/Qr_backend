import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
} from 'class-validator';

import { AddressLabel } from '../../../common/enums/address-label.enum';

export class CreateAddressDto {
  // Normalizes casing ("Home", "HOME", "home" -> "home") before validation
  // even runs, so a mismatched-case value fails as a clean 400 from
  // @IsEnum here instead of surfacing as a raw QueryFailedError from
  // Postgres once it hits the enum column.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(AddressLabel)
  label?: AddressLabel;

  @IsString()
  addressLine!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}