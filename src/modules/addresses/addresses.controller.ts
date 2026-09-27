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

import { AddressesService } from './addresses.service';

import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { GetUser } from '../../common/decorators/get-user.decorator';

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
  ) {}

  @Get()
  findMine(
    @GetUser('id') userId: string,
  ) {
    return this.addressesService.findAllForUser(
      userId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ) {
    return this.addressesService.findOne(
      id,
      userId,
    );
  }

  @Post()
  create(
    @GetUser('id') userId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.create(
      userId,
      dto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(
      id,
      userId,
      dto,
    );
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ) {
    return this.addressesService.remove(
      id,
      userId,
    );
  }
}