import { Module } from '@nestjs/common';
import { ConfigModule,ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { getTypeOrmConfig } from './config/typeorm.config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { MenuItemsModule } from './modules/menu-items/menu-items.module';
import { BranchesModule } from './modules/branches/branches.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AdminModule } from './modules/admin/admin.module';
import { UserSessionsModule } from './modules/user-sessions/user-sessions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { PlacesModule } from './modules/places/places.module';
import { TablesModule } from './modules/tables/tables.module';



@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    load:[configuration]
  }),

  ScheduleModule.forRoot(),
  ThrottlerModule.forRoot([
  {
    ttl: 60_000, // 1 minute
    limit: 100,  // General API limit
  },
]),

TypeOrmModule.forRootAsync({
    imports:[ConfigModule],
    inject:[ConfigService],
    useFactory:getTypeOrmConfig,}),
UsersModule,
AuthModule,
RestaurantsModule,
CategoriesModule,
MenuItemsModule,
BranchesModule,
AddressesModule,
OrdersModule,
AdminModule,
UserSessionsModule,
PaymentsModule,
ReviewsModule,
PlacesModule,
TablesModule,
],
  controllers: [AppController],
  providers: [AppService, {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  },],
})
export class AppModule {}
