import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { MenuItem } from './entities/menu-item.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { Category } from '../categories/entities/category.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { MenuAddon } from './entities/menu-addon.entity';

import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

import { Role } from '../../common/enums/role.enum';

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemsRepository: Repository<MenuItem>,

    @InjectRepository(Restaurant)
    private readonly restaurantsRepository: Repository<Restaurant>,

    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,

    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(MenuAddon)
    private readonly menuAddonsRepository: Repository<MenuAddon>,
  ) {}

  private async resolveAddOns(
    addOnIds: string[] | undefined,
    restaurantId: string,
  ): Promise<MenuAddon[] | undefined> {
    if (addOnIds === undefined) return undefined;
    if (addOnIds.length === 0) return [];

    const addOns = await this.menuAddonsRepository.find({
      where: { id: In(addOnIds), restaurantId, isAvailable: true },
    });
    if (addOns.length !== addOnIds.length) {
      throw new BadRequestException(
        'One or more add-ons are unavailable or belong to another restaurant.',
      );
    }
    return addOns;
  }

  /**
   * Loads the requesting branch manager and confirms they're actually
   * assigned to a branch. Shared by create/update/remove so the same
   * "not assigned yet" error reads consistently everywhere.
   */
  private async getManagerBranch(managerId: string): Promise<Branch> {
    const manager = await this.usersRepository.findOne({
      where: { id: managerId },
    });

    if (!manager || manager.role !== Role.BRANCH_MANAGER) {
      throw new ForbiddenException(
        'Only branch managers can manage a branch-specific menu.',
      );
    }

    if (!manager.assignedBranchId) {
      throw new BadRequestException(
        "You aren't assigned to a branch yet. Ask your restaurant owner to assign you before managing its menu.",
      );
    }

    const branch = await this.branchesRepository.findOne({
      where: { id: manager.assignedBranchId },
    });

    if (!branch) {
      throw new NotFoundException('Your assigned branch could not be found.');
    }

    return branch;
  }

  async create(
    requesterId: string,
    requesterRole: Role,
    dto: CreateMenuItemDto,
  ): Promise<MenuItem> {
    const restaurant = await this.restaurantsRepository.findOne({
      where: {
        id: dto.restaurantId,
        isActive: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    let branchId: string | null = dto.branchId ?? null;

    if (requesterRole === Role.BRANCH_MANAGER) {
      const branch = await this.getManagerBranch(requesterId);

      if (branch.restaurantId !== dto.restaurantId) {
        throw new ForbiddenException(
          'Your assigned branch does not belong to this restaurant.',
        );
      }

      // A branch manager's items are always scoped to their own branch,
      // regardless of what (if anything) was sent in the request.
      branchId = branch.id;
    } else {
      const isAdmin = requesterRole === Role.ADMIN;

      if (!isAdmin && restaurant.ownerId !== requesterId) {
        throw new ForbiddenException(
          'You do not have permission to manage this restaurant.',
        );
      }

      if (branchId) {
        const branch = await this.branchesRepository.findOne({
          where: { id: branchId, restaurantId: dto.restaurantId },
        });

        if (!branch) {
          throw new NotFoundException(
            'Branch not found for this restaurant.',
          );
        }
      }
    }

    if (dto.categoryId) {
      const category = await this.categoriesRepository.findOne({
        where: {
          id: dto.categoryId,
          restaurantId: dto.restaurantId,
          isActive: true,
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found.');
      }
    }

    const { addOnIds, ...menuItemData } = dto;
    const addOns = await this.resolveAddOns(addOnIds, dto.restaurantId);
    const item = this.menuItemsRepository.create({
      ...menuItemData,
      branchId,
      ...(addOns !== undefined && { addOns }),
    });

    return this.menuItemsRepository.save(item);
  }

  async findByRestaurant(
    restaurantId: string,
    categoryId?: string,
    branchId?: string,
  ): Promise<MenuItem[]> {
    const base = {
      restaurantId,
      isAvailable: true,
      ...(categoryId && { categoryId }),
    };

    // With a branchId: that branch's own items PLUS the restaurant-wide
    // (branchId IS NULL) shared menu. Without one: everything, regardless
    // of branch — used by owner/admin management views.
    const where = branchId
      ? [{ ...base, branchId }, { ...base, branchId: IsNull() }]
      : base;

    const items = await this.menuItemsRepository.find({
      where,
      relations: {
        category: true,
        addOns: true,
      },
      order: {
        displayOrder: 'ASC',
        name: 'ASC',
      },
    });
    return items.map((item) => ({
      ...item,
      addOns: item.addOns.filter((addon) => addon.isAvailable),
    }));
  }

  async findOne(id: string): Promise<MenuItem> {
    const item = await this.menuItemsRepository.findOne({
      where: {
        id,
        isAvailable: true,
      },
      relations: {
        category: true,
        restaurant: true,
        branch: true,
        addOns: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found.');
    }

    return item;
  }

  async update(
    id: string,
    requesterId: string,
    requesterRole: Role,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    const item = await this.menuItemsRepository.findOne({
      where: { id },
      relations: {
        category: true,
        restaurant: true,
        branch: true,
        addOns: true,
      },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found.');
    }

    if (requesterRole === Role.BRANCH_MANAGER) {
      const branch = await this.getManagerBranch(requesterId);

      if (item.branchId !== branch.id) {
        throw new ForbiddenException(
          item.branchId
            ? 'This item belongs to a different branch.'
            : 'Only the restaurant owner/admin can edit shared menu items.',
        );
      }

      // Managers can't move an item to a different branch or make it
      // restaurant-wide.
      delete dto.branchId;
    } else {
      const isAdmin = requesterRole === Role.ADMIN;

      if (!isAdmin && item.restaurant.ownerId !== requesterId) {
        throw new ForbiddenException(
          'You do not have permission to update this menu item.',
        );
      }

      if (dto.branchId) {
        const branch = await this.branchesRepository.findOne({
          where: { id: dto.branchId, restaurantId: item.restaurantId },
        });

        if (!branch) {
          throw new NotFoundException(
            'Branch not found for this restaurant.',
          );
        }
      }
    }

    if (dto.categoryId) {
      const category = await this.categoriesRepository.findOne({
        where: {
          id: dto.categoryId,
          restaurantId: item.restaurantId,
          isActive: true,
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found.');
      }
    }

    delete dto.restaurantId;
    const { addOnIds, ...menuItemData } = dto;
    const updatedItem = this.menuItemsRepository.merge(item, menuItemData);
    const addOns = await this.resolveAddOns(addOnIds, item.restaurantId);
    if (addOns !== undefined) updatedItem.addOns = addOns;

    return this.menuItemsRepository.save(updatedItem);
  }

  async remove(
    id: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<void> {
    const item = await this.findOne(id);

    if (requesterRole === Role.BRANCH_MANAGER) {
      const branch = await this.getManagerBranch(requesterId);

      if (item.branchId !== branch.id) {
        throw new ForbiddenException(
          item.branchId
            ? 'This item belongs to a different branch.'
            : 'Only the restaurant owner/admin can remove shared menu items.',
        );
      }
    } else {
      const isAdmin = requesterRole === Role.ADMIN;

      if (!isAdmin && item.restaurant.ownerId !== requesterId) {
        throw new ForbiddenException(
          'You do not have permission to delete this menu item.',
        );
      }
    }

    item.isAvailable = false;

    await this.menuItemsRepository.save(item);
  }
}
