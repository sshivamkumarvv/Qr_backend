import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
  ) {}

  /**
   * Customer
   * Review a delivered order (one review per order).
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  create(
    @GetUser('id') customerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(customerId, dto);
  }

  /**
   * Customer
   * My own reviews.
   */
  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  findMine(@GetUser('id') customerId: string) {
    return this.reviewsService.findMyReviews(customerId);
  }

  /**
   * Public
   */
  @Get('restaurant/:restaurantId')
  findByRestaurant(
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.reviewsService.findByRestaurant(restaurantId);
  }

  /**
   * Public
   */
  @Get('restaurant/:restaurantId/summary')
  getSummary(@Param('restaurantId') restaurantId: string) {
    return this.reviewsService.getRestaurantSummary(
      restaurantId,
    );
  }
}
