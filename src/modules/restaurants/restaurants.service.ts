import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Restaurant } from './entities/restaurant.entity';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantsRepository: Repository<Restaurant>,
  ) {}

  async create(
    ownerId: string,
    dto: CreateRestaurantDto,
  ): Promise<Restaurant> {
    // One restaurant per owner
    const existingRestaurant = await this.restaurantsRepository.findOne({
      where: {
        ownerId,
        isActive: true,
      },
    });

    if (existingRestaurant) {
      throw new ConflictException(
        'You already own an active restaurant.',
      );
    }

    const restaurant = this.restaurantsRepository.create({
      ...dto,
      ownerId,
    });

    return this.restaurantsRepository.save(restaurant);
  }

  async findAll(): Promise<Restaurant[]> {
    return this.restaurantsRepository.find({
      where: {
        isActive: true,
      },
      relations: {
        branches: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurantsRepository.findOne({
      where: {
        id,
        isActive: true,
      },
      relations: {
        categories: true,
        menuItems: true,
        branches: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    return restaurant;
  }

  async findByOwner(ownerId: string): Promise<Restaurant> {
    const restaurant = await this.restaurantsRepository.findOne({
      where: {
        ownerId,
        isActive: true,
      },
      relations: {
        categories: true,
        menuItems: true,
        branches: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    return restaurant;
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateRestaurantDto,
  ): Promise<Restaurant> {
    const restaurant = await this.findOne(id);

    this.assertOwnership(restaurant, ownerId);

    const updatedRestaurant = this.restaurantsRepository.merge(
      restaurant,
      dto,
    );

    return this.restaurantsRepository.save(updatedRestaurant);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const restaurant = await this.findOne(id);

    this.assertOwnership(restaurant, ownerId);

    restaurant.isActive = false;

    await this.restaurantsRepository.save(restaurant);
  }

  private assertOwnership(
    restaurant: Restaurant,
    ownerId: string,
  ): void {
    if (restaurant.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You do not have permission to modify this restaurant.',
      );
    }
  }
}