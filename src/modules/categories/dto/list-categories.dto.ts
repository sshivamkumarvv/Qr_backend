import { IsUUID } from 'class-validator';

export class ListCategoriesDto {
  @IsUUID()
  restaurantId!: string;
}