import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Branch } from './entities/branch.entity';
import { RestaurantsModule } from '../restaurants/restaurants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch]),
    RestaurantsModule,
  ],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}