import {
  IsBoolean,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
  ArrayUnique,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  discountedPrice?: number;

  // Optional dine-in-specific price — omit to reuse price/discountedPrice
  // for dine-in orders too.
  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  dineInPrice?: number;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isCustomizable?: boolean;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  preparationTime?: number;

  @IsUUID()
  restaurantId!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  // Only honored for restaurant owners/admins — branch managers always
  // get their own assigned branch, regardless of what's sent here (see
  // MenuItemsService.create).
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  addOnIds?: string[];
}