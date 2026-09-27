import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsPhoneNumber,
  Length,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(255)
  addressLine!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(6, 10)
  pincode?: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsPhoneNumber('IN')
  phone?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  serviceRadiusKm?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'openingTime must be in HH:mm format',
  })
  openingTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'closingTime must be in HH:mm format',
  })
  closingTime?: string;

  @IsUUID()
  restaurantId!: string;
}