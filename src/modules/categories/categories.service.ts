import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,

    @InjectRepository(Restaurant)
    private readonly restaurantsRepository: Repository<Restaurant>,
  ) {}



  async create(
    ownerId: string,
    dto: CreateCategoryDto,
  ): Promise<Category> {
    const restaurant = await this.restaurantsRepository.findOne({
      where: {
        id: dto.restaurantId,
        isActive: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    if (restaurant.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You do not have permission to manage this restaurant.',
      );
    }

    const category = this.categoriesRepository.create(dto);

    return this.categoriesRepository.save(category);
  }

  async findByRestaurant(
    restaurantId: string,
  ): Promise<Category[]> {
    return this.categoriesRepository.find({
      where: {
        restaurantId,
        isActive: true,
      },
      order: {
        displayOrder: 'ASC',
        name: 'ASC',
      },
    });
  }

async findOne(id: string): Promise<Category> {
  const category = await this.categoriesRepository.findOne({
    where: {
      id,
      isActive: true,
    },
    relations: {
      restaurant: true,
    },
  });

  if (!category) {
    throw new NotFoundException('Category not found.');
  }

  return category;
}

  async remove(
    id: string,
    ownerId: string,
  ): Promise<void> {
    const category = await this.findOne(id);

    if (category.restaurant.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You do not have permission to delete this category.',
      );
    }

    category.isActive = false;

    await this.categoriesRepository.save(category);
  }
  async update(
  id: string,
  ownerId: string,
  dto: UpdateCategoryDto,
): Promise<Category> {
  const category = await this.findOne(id);

  if (category.restaurant.ownerId !== ownerId) {
    throw new ForbiddenException(
      'You do not have permission to update this category.',
    );
  }

  const updatedCategory = this.categoriesRepository.merge(
    category,
    dto,
  );

  return this.categoriesRepository.save(updatedCategory);
}
}