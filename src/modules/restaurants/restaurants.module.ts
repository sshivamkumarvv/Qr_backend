import { Module } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';
import { Restaurant } from './entities/restaurant.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Restaurant])],
  providers: [RestaurantsService],
  controllers: [RestaurantsController],
  exports: [RestaurantsService],

})
export class RestaurantsModule {}
