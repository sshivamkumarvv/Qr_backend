import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTableDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MaxLength(20)
  tableNumber!: string;
}
