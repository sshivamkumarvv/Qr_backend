import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressesRepository: Repository<Address>,
  ) {}

  async create(
    userId: string,
    dto: CreateAddressDto,
  ): Promise<Address> {
    const count = await this.addressesRepository.count({
      where: { userId },
    });

    const isFirstAddress = count === 0;

    if (dto.isDefault || isFirstAddress) {
      await this.clearExistingDefault(userId);
    }

    const address = this.addressesRepository.create({
      ...dto,
      userId,
      isDefault: dto.isDefault || isFirstAddress,
    });

    return this.addressesRepository.save(address);
  }

  async findAllForUser(
    userId: string,
  ): Promise<Address[]> {
    return this.addressesRepository.find({
      where: { userId },
      order: {
        isDefault: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<Address> {
    const address = await this.addressesRepository.findOne({
      where: { id },
    });

    if (!address) {
      throw new NotFoundException('Address not found.');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException(
        'This address does not belong to you.',
      );
    }

    return address;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.findOne(id, userId);

    if (dto.isDefault) {
      await this.clearExistingDefault(userId);
    }

    const updatedAddress = this.addressesRepository.merge(
      address,
      dto,
    );

    return this.addressesRepository.save(updatedAddress);
  }

  async remove(
    id: string,
    userId: string,
  ): Promise<void> {
    const address = await this.findOne(id, userId);

    const totalAddresses =
      await this.addressesRepository.count({
        where: { userId },
      });

    if (totalAddresses === 1) {
      throw new BadRequestException(
        'You must have at least one address.',
      );
    }

    const wasDefault = address.isDefault;

    await this.addressesRepository.remove(address);

    if (wasDefault) {
      const nextAddress =
        await this.addressesRepository.findOne({
          where: { userId },
          order: {
            createdAt: 'ASC',
          },
        });

      if (nextAddress) {
        nextAddress.isDefault = true;
        await this.addressesRepository.save(nextAddress);
      }
    }
  }

  private async clearExistingDefault(
    userId: string,
  ): Promise<void> {
    await this.addressesRepository.update(
      {
        userId,
        isDefault: true,
      },
      {
        isDefault: false,
      },
    );
  }
}