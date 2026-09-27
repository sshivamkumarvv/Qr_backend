import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersGateway } from './gateway/orders.gateway';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';

import { User } from '../users/entities/user.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { Branch } from '../branches/entities/branch.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';
import { Address } from '../addresses/entities/address.entity';

import { BranchesModule } from '../branches/branches.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { TablesModule } from '../tables/tables.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderStatusHistory,
      User,
      Restaurant,
      Branch,
      MenuItem,
      Address,
    ]),
    BranchesModule,
    RestaurantsModule,
    TablesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersService, OrdersGateway],

})
export class OrdersModule {}