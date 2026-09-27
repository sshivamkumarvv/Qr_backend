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

import { CategoriesService } from './categories.service';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

import { Role } from '../../common/enums/role.enum';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * Public
   * GET /categories?restaurantId=<uuid>
   */
  @Get()
  findByRestaurant(
    @Query() query: ListCategoriesDto,
  ) {
    return this.categoriesService.findByRestaurant(
      query.restaurantId,
    );
  }

  /**
   * Public
   * GET /categories/:id
   */
  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.categoriesService.findOne(id);
  }

  /**
   * Restaurant Owner / Admin
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  create(
    @GetUser('id') ownerId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(ownerId, dto);
  }

  /**
   * Restaurant Owner / Admin
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @GetUser('id') ownerId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(
      id,
      ownerId,
      dto,
    );
  }

  /**
   * Restaurant Owner / Admin
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @GetUser('id') ownerId: string,
  ) {
    return this.categoriesService.remove(
      id,
      ownerId,
    );
  }
}