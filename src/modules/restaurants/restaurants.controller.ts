import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

import { Role } from '../../common/enums/role.enum';

@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
  ) {}

  /**
   * Public - List all active restaurants
   */
  @Get()
  findAll() {
    return this.restaurantsService.findAll();
  }

    /**
   * Owner - Get own restaurant
   */
  @Get('owner/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER)
  findMyRestaurant(@GetUser('id') ownerId: string) {
    return this.restaurantsService.findByOwner(ownerId);
  }

  /**
   * Public - Get restaurant by ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.restaurantsService.findOne(id);
  }



  /**
   * Owner/Admin - Create restaurant
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  create(
    @GetUser('id') ownerId: string,
    @Body() dto: CreateRestaurantDto,
  ) {
    return this.restaurantsService.create(ownerId, dto);
  }

  /**
   * Owner/Admin - Update restaurant
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @GetUser('id') ownerId: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurantsService.update(id, ownerId, dto);
  }

  /**
   * Owner/Admin - Soft delete restaurant
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @GetUser('id') ownerId: string,
  ) {
    return this.restaurantsService.remove(id, ownerId);
  }
}