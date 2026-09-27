import {
  BadRequestException,
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

import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import {
  FindNearestBranchDto,
  ListBranchesQueryDto,
} from './dto/find-nearest-branch.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

import { Role } from '../../common/enums/role.enum';
import { RestaurantsService } from '../restaurants/restaurants.service';

@Controller('branches')
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  /**
   * Public
   * GET /branches?restaurantId=xxx&lat=12.93&lng=77.61
   */
  @Get()
  findByRestaurant(@Query() query: ListBranchesQueryDto) {
    if (!query.restaurantId) {
      throw new BadRequestException(
        'restaurantId query parameter is required.',
      );
    }

    return this.branchesService.findByRestaurantWithDistance(
      query.restaurantId,
      query.lat,
      query.lng,
    );
  }

  /**
   * Public
   * GET /branches/nearest?restaurantId=xxx&lat=12.93&lng=77.61
   */
  @Get('nearest')
  findNearest(@Query() query: FindNearestBranchDto) {
    return this.branchesService.findNearest(
      query.restaurantId,
      query.lat,
      query.lng,
    );
  }

  /**
   * Owner
   * GET /branches/owner/me
   */
  @Get('owner/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER)
  async findMyBranches(
    @GetUser('id') ownerId: string,
  ) {
    const restaurant =
      await this.restaurantsService.findByOwner(ownerId);

    return this.branchesService.findByRestaurant(restaurant.id);
  }

  /**
   * Public
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  /**
   * Owner/Admin
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  create(
    @GetUser('id') ownerId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branchesService.create(ownerId, dto);
  }

  /**
   * Owner/Admin
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @GetUser('id') ownerId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(
      id,
      ownerId,
      dto,
    );
  }

  /**
   * Owner/Admin
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @GetUser('id') ownerId: string,
  ) {
    return this.branchesService.remove(id, ownerId);
  }
}