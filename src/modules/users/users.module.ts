import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports:[TypeOrmModule.forFeature([User]), BranchesModule],
  providers: [UsersService],
  controllers: [UsersController]
})
export class UsersModule {}
