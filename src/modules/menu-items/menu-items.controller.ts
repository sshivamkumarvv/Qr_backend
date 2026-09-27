import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { MenuItemsService } from './menu-items.service';

import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

import { Role } from '../../common/enums/role.enum';
import { ListMenuItemsDto } from './dto/list-menu-items.dto';

@Controller('menu-items')
export class MenuItemsController {
  constructor(
    private readonly menuItemsService: MenuItemsService,
  ) {}

  @Get()
  findByRestaurant(
    @Query() query: ListMenuItemsDto,
  ) {
    return this.menuItemsService.findByRestaurant(
      query.restaurantId,
      query.categoryId,
      query.branchId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.menuItemsService.findOne(id);
  }

  /**
   * Restaurant Owner / Admin — restaurant-wide or a chosen branch.
   * Branch Manager — always scoped to their own assigned branch,
   * regardless of what's sent in the body (see MenuItemsService.create).
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN, Role.BRANCH_MANAGER)
  create(
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menuItemsService.create(
      requesterId,
      requesterRole,
      dto,
    );
  }

  /**
   * Restaurant Owner / Admin — any item on their restaurant.
   * Branch Manager — only items already scoped to their own branch.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN, Role.BRANCH_MANAGER)
  update(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuItemsService.update(
      id,
      requesterId,
      requesterRole,
      dto,
    );
  }

  /**
   * Restaurant Owner / Admin — any item on their restaurant.
   * Branch Manager — only items already scoped to their own branch.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN, Role.BRANCH_MANAGER)
  remove(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
  ) {
    return this.menuItemsService.remove(
      id,
      requesterId,
      requesterRole,
    );
  }
}
