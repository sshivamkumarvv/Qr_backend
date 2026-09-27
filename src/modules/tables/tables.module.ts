import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';
import { RestaurantTable } from './entities/table.entity';

import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantTable]), BranchesModule],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
