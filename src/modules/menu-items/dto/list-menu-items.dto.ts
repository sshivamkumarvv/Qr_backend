import {
  IsOptional,
  IsUUID,
} from 'class-validator';

export class ListMenuItemsDto {
  @IsUUID()
  restaurantId!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  // When provided: items scoped to this branch PLUS restaurant-wide
  // (branchId IS NULL) items. When omitted: everything for the
  // restaurant regardless of branch (useful for owner/admin management
  // views that need to see the whole menu across all branches).
  @IsOptional()
  @IsUUID()
  branchId?: string;
}