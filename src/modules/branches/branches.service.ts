import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { haversineDistanceKm } from '../../common/utils/geo.util';

export interface BranchWithDistance {
  branch: Branch;
  distanceKm: number;
}

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateBranchDto,
  ): Promise<Branch> {
    const restaurant =
      await this.restaurantsService.findByOwner(ownerId);

    const branch = this.branchesRepository.create({
      ...dto,
      restaurantId: restaurant.id,
    });

    return this.branchesRepository.save(branch);
  }

  async findByRestaurant(
    restaurantId: string,
  ): Promise<Branch[]> {
    return this.branchesRepository.find({
      where: {
        restaurantId,
        isActive: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async findByRestaurantWithDistance(
    restaurantId: string,
    lat?: number,
    lng?: number,
  ): Promise<(Branch & { distanceKm?: number })[]> {
    const branches = await this.findByRestaurant(restaurantId);

    if (lat === undefined || lng ===undefined) {
      return branches;
    }

    return branches
      .map((branch) => ({
        ...branch,
        distanceKm: haversineDistanceKm(
          lat,
          lng,
          branch.latitude,
          branch.longitude,
        ),
      }))
      .sort((a, b) => a.distanceKm! - b.distanceKm!);
  }

  async findNearest(
    restaurantId: string,
    lat: number,
    lng: number,
  ): Promise<BranchWithDistance> {
    const branches = await this.findByRestaurant(restaurantId);

    if (!branches.length) {
      throw new NotFoundException(
        'No active branches found.',
      );
    }

    const distances = branches.map((branch) => ({
      branch,
      distanceKm: haversineDistanceKm(
        lat,
        lng,
        branch.latitude,
        branch.longitude,
      ),
    }));

    const serviceable = distances.filter(
      ({ branch, distanceKm }) =>
        branch.serviceRadiusKm == null ||
        distanceKm <= Number(branch.serviceRadiusKm),
    );

    const result =
      (serviceable.length ? serviceable : distances).sort(
        (a, b) => a.distanceKm - b.distanceKm,
      )[0];

    return result;
  }

  async findOne(id: string): Promise<Branch> {
    const branch = await this.branchesRepository.findOne({
      where: {
        id,
        isActive: true,
      },
      relations: {
        restaurant: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found.');
    }

    return branch;
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateBranchDto,
  ): Promise<Branch> {
    const branch = await this.findOne(id);

    this.assertOwnership(branch, ownerId);

    const updatedBranch = this.branchesRepository.merge(
      branch,
      dto,
    );

    return this.branchesRepository.save(updatedBranch);
  }

  async remove(
    id: string,
    ownerId: string,
  ): Promise<void> {
    const branch = await this.findOne(id);

    this.assertOwnership(branch, ownerId);

    branch.isActive = false;

    await this.branchesRepository.save(branch);
  }

  private assertOwnership(
    branch: Branch,
    ownerId: string,
  ): void {
    if (branch.restaurant.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You do not have permission to modify this branch.',
      );
    }
  }
}