import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../../common/enums/role.enum';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { CreateMenuAddonDto } from './dto/create-menu-addon.dto';
import { UpdateMenuAddonDto } from './dto/update-menu-addon.dto';
import { MenuAddon } from './entities/menu-addon.entity';

@Injectable()
export class MenuAddonsService {
  constructor(
    @InjectRepository(MenuAddon)
    private readonly addonsRepository: Repository<MenuAddon>,
    @InjectRepository(Restaurant)
    private readonly restaurantsRepository: Repository<Restaurant>,
  ) {}

  private async assertCanManage(
    restaurantId: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<void> {
    const restaurant = await this.restaurantsRepository.findOne({
      where: { id: restaurantId, isActive: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found.');
    if (requesterRole !== Role.ADMIN && restaurant.ownerId !== requesterId) {
      throw new ForbiddenException(
        'You do not have permission to manage this restaurant.',
      );
    }
  }

  async findByRestaurant(restaurantId: string): Promise<MenuAddon[]> {
    return this.addonsRepository.find({
      where: { restaurantId, isAvailable: true },
      order: { name: 'ASC' },
    });
  }

  async create(
    requesterId: string,
    requesterRole: Role,
    dto: CreateMenuAddonDto,
  ): Promise<MenuAddon> {
    await this.assertCanManage(dto.restaurantId, requesterId, requesterRole);
    return this.addonsRepository.save(this.addonsRepository.create(dto));
  }

  async update(
    id: string,
    requesterId: string,
    requesterRole: Role,
    dto: UpdateMenuAddonDto,
  ): Promise<MenuAddon> {
    const addon = await this.addonsRepository.findOne({ where: { id } });
    if (!addon) throw new NotFoundException('Add-on not found.');
    await this.assertCanManage(addon.restaurantId, requesterId, requesterRole);
    Object.assign(addon, dto);
    return this.addonsRepository.save(addon);
  }

  async remove(
    id: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<void> {
    const addon = await this.addonsRepository.findOne({ where: { id } });
    if (!addon) throw new NotFoundException('Add-on not found.');
    await this.assertCanManage(addon.restaurantId, requesterId, requesterRole);
    addon.isAvailable = false;
    await this.addonsRepository.save(addon);
  }
}