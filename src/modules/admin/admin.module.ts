import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Category } from '../categories/entities/category.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';

import { OrdersModule } from '../orders/orders.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { BranchesModule } from '../branches/branches.module';
import { CategoriesModule } from '../categories/categories.module';
import { MenuItemsModule } from '../menu-items/menu-items.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Order,
      Restaurant,
      Branch,
      Category,
      MenuItem,
    ]),
    OrdersModule,
    RestaurantsModule,
    BranchesModule,
    CategoriesModule,
    MenuItemsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}