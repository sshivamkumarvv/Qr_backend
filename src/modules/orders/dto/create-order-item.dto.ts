import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  menuItemId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  portion?: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  addOnIds?: string[];

  @IsOptional()
  customization?: Record<string, any>;
}