import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { AssignBranchDto } from './dto/assign-branch.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

import { BRANCH_SCOPED_ROLES, Role } from '../../common/enums/role.enum';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Restaurant Owner / Admin
   * Look up a rider or branch manager by phone number, to onboard/assign
   * them. Only ever returns a user if they're already one of those two
   * roles — this isn't a general "look anyone up by phone" endpoint.
   */
  @Get('lookup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  async lookupStaff(@Query('phone') phone: string) {
    const user = await this.usersService.findByPhone(phone);

    if (!user || !BRANCH_SCOPED_ROLES.includes(user.role)) {
      throw new NotFoundException(
        'No rider or branch manager found with that phone number.',
      );
    }

    return user;
  }

  /**
   * Restaurant Owner / Admin
   * Promote a customer account to rider.
   */
  @Patch(':id/promote-to-rider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  promoteToRider(@Param('id') id: string) {
    return this.usersService.promoteToRider(id);
  }

  /**
   * Restaurant Owner / Admin
   * Promote a customer account to branch manager.
   */
  @Patch(':id/promote-to-branch-manager')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  promoteToBranchManager(@Param('id') id: string) {
    return this.usersService.promoteToBranchManager(id);
  }

  /**
   * Restaurant Owner / Admin
   * Assign a rider or branch manager to a branch.
   */
  @Patch(':id/assign-branch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  assignBranch(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
    @Body() dto: AssignBranchDto,
  ) {
    return this.usersService.assignBranch(
      id,
      dto.branchId,
      requesterId,
      requesterRole,
    );
  }

  /**
   * Restaurant Owner / Admin
   * Clear a rider's or branch manager's branch assignment.
   */
  @Patch(':id/unassign-branch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  unassignBranch(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
  ) {
    return this.usersService.unassignBranch(id, requesterId, requesterRole);
  }

  /**
   * Admin
   * Directly set any user's role.
   */
  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.usersService.changeRole(id, dto.role);
  }
}
