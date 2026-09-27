import { Module } from '@nestjs/common';
import { MenuItemsService } from './menu-items.service';
import { MenuItemsController } from './menu-items.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { Category } from '../categories/entities/category.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { MenuAddon } from './entities/menu-addon.entity';
import { MenuAddonsController } from './menu-addons.controller';
import { MenuAddonsService } from './menu-addons.service';

@Module({
  imports:[TypeOrmModule.forFeature([MenuItem,MenuAddon,Restaurant,Category,Branch,User])],
  providers: [MenuItemsService, MenuAddonsService],
  controllers: [MenuItemsController, MenuAddonsController],
  exports:[MenuItemsService]
})
export class MenuItemsModule {}
