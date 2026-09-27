import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Review } from './entities/review.entity';
import { Order } from '../orders/entities/order.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { User } from '../users/entities/user.entity';

import { OrderStatus } from '../../common/enums/order-status.enum';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,

    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,

    @InjectRepository(Restaurant)
    private readonly restaurantsRepository: Repository<Restaurant>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(
    customerId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const order = await this.ordersRepository.findOne({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException(
        'This order does not belong to you.',
      );
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'You can only review orders that have been delivered.',
      );
    }

    const existing = await this.reviewsRepository.findOne({
      where: { orderId: order.id },
    });

    if (existing) {
      throw new ConflictException(
        'You have already reviewed this order.',
      );
    }

    const customer = await this.usersRepository.findOne({
      where: { id: customerId },
    });

    const review = this.reviewsRepository.create({
      orderId: order.id,
      customerId,
      customerName: customer?.fullName ?? order.customerName,
      restaurantId: order.restaurantId,
      rating: dto.rating,
      comment: dto.comment ?? null,
    });

    const saved = await this.reviewsRepository.save(review);

    await this.recalculateRestaurantRating(order.restaurantId);

    return saved;
  }

  async findByRestaurant(restaurantId: string): Promise<Review[]> {
    return this.reviewsRepository.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findMyReviews(customerId: string): Promise<Review[]> {
    return this.reviewsRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  async getRestaurantSummary(restaurantId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    const { average, count } =
      await this.computeAverage(restaurantId);

    return {
      averageRating: average,
      totalReviews: count,
    };
  }

  private async computeAverage(
    restaurantId: string,
  ): Promise<{ average: number; count: number }> {
    const result = await this.reviewsRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('review.restaurantId = :restaurantId', {
        restaurantId,
      })
      .getRawOne<{ average: string | null; count: string }>();

    return {
      average: result?.average
        ? Number(Number(result.average).toFixed(1))
        : 0,
      count: result?.count ? Number(result.count) : 0,
    };
  }

  private async recalculateRestaurantRating(
    restaurantId: string,
  ): Promise<void> {
    const { average } = await this.computeAverage(restaurantId);

    await this.restaurantsRepository.update(restaurantId, {
      rating: average,
    });
  }
}
