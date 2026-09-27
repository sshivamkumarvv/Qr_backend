import {
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMenuAddonDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsUUID()
  restaurantId!: string;
}