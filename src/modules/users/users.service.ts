import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

import { BRANCH_SCOPED_ROLES, Role } from '../../common/enums/role.enum';
import { BranchesService } from '../branches/branches.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly branchesService: BranchesService,
  ) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  /**
   * Restaurant owner / Admin
   * Promote a customer account to a rider. Only works on plain customer
   * accounts, so you can't accidentally demote a restaurant owner/admin
   * into a rider by hitting this with the wrong id.
   */
  async promoteToRider(targetUserId: string): Promise<User> {
    return this.promoteCustomerTo(targetUserId, Role.RIDER);
  }

  /**
   * Restaurant owner / Admin
   * Promote a customer account to a branch manager. Same guard as
   * promoteToRider — only plain customer accounts qualify.
   */
  async promoteToBranchManager(targetUserId: string): Promise<User> {
    return this.promoteCustomerTo(targetUserId, Role.BRANCH_MANAGER);
  }

  private async promoteCustomerTo(
    targetUserId: string,
    role: Role,
  ): Promise<User> {
    const user = await this.findById(targetUserId);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role !== Role.CUSTOMER) {
      throw new BadRequestException(
        `Only customer accounts can be promoted to ${role}.`,
      );
    }

    user.role = role;

    return this.userRepository.save(user);
  }

  /**
   * Restaurant owner / Admin
   * Assign a rider or branch manager to a branch. Restaurant owners may
   * only assign to branches they actually own (Admin bypasses that check).
   */
  async assignBranch(
    userId: string,
    branchId: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<User> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!BRANCH_SCOPED_ROLES.includes(user.role)) {
      throw new BadRequestException(
        'That user is not a rider or branch manager.',
      );
    }

    const branch = await this.branchesService.findOne(branchId);

    if (
      requesterRole !== Role.ADMIN &&
      branch.restaurant.ownerId !== requesterId
    ) {
      throw new ForbiddenException(
        'You do not have permission to assign staff to this branch.',
      );
    }

    user.assignedBranchId = branch.id;

    return this.userRepository.save(user);
  }

  /**
   * Restaurant owner / Admin
   * Clear a rider's or branch manager's branch assignment.
   */
  async unassignBranch(
    userId: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<User> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!BRANCH_SCOPED_ROLES.includes(user.role)) {
      throw new BadRequestException(
        'That user is not a rider or branch manager.',
      );
    }

    if (user.assignedBranchId && requesterRole !== Role.ADMIN) {
      const branch = await this.branchesService.findOne(
        user.assignedBranchId,
      );

      if (branch.restaurant.ownerId !== requesterId) {
        throw new ForbiddenException(
          'You do not have permission to modify this user.',
        );
      }
    }

    user.assignedBranchId = null;

    return this.userRepository.save(user);
  }

  /**
   * Admin
   * Directly set any user's role — for fixing mistakes or onboarding
   * roles that don't go through the promote* helpers (e.g. admin
   * accounts). Clears any branch assignment if the new role isn't
   * branch-scoped, so a demoted user doesn't keep a stale assignment.
   */
  async changeRole(targetUserId: string, role: Role): Promise<User> {
    const user = await this.findById(targetUserId);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    user.role = role;

    if (!BRANCH_SCOPED_ROLES.includes(role)) {
      user.assignedBranchId = null;
    }

    return this.userRepository.save(user);
  }
}
