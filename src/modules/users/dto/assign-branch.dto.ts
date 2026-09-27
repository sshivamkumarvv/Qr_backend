import { IsUUID } from 'class-validator';

export class AssignBranchDto {
  @IsUUID()
  branchId!: string;
}
