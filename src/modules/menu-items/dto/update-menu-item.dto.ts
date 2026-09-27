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

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  discountedPrice?: number;

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

  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  // Owner/admin only in practice — branch managers can't move an item to
  // a different branch (see MenuItemsService.update). Send null/omit to
  // leave unchanged; there's currently no way to explicitly clear it back
  // to restaurant-wide via this DTO alone — do that via the owner/admin
  // path directly on the entity if needed.
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  addOnIds?: string[];
}