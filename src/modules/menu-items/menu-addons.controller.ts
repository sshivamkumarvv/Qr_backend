import {
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

import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMenuAddonDto } from './dto/create-menu-addon.dto';
import { UpdateMenuAddonDto } from './dto/update-menu-addon.dto';
import { MenuAddonsService } from './menu-addons.service';

@Controller('menu-addons')
export class MenuAddonsController {
  constructor(private readonly menuAddonsService: MenuAddonsService) {}

  @Get()
  findByRestaurant(@Query('restaurantId') restaurantId: string) {
    return this.menuAddonsService.findByRestaurant(restaurantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  create(
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
    @Body() dto: CreateMenuAddonDto,
  ) {
    return this.menuAddonsService.create(requesterId, requesterRole, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
    @Body() dto: UpdateMenuAddonDto,
  ) {
    return this.menuAddonsService.update(id, requesterId, requesterRole, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
  ) {
    return this.menuAddonsService.remove(id, requesterId, requesterRole);
  }
}