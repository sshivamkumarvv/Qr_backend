import { IsEnum } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class ChangeRoleDto {
  @IsEnum(Role)
  role!: Role;
}
