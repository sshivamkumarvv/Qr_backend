import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateMenuAddonDto {
	@IsOptional()
	@IsString()
	@MaxLength(100)
	name?: string;

	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	price?: number;

	@IsOptional()
	@IsBoolean()
	isAvailable?: boolean;
}