import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { OrdersService } from './orders.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

import { Role } from '../../common/enums/role.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Customer
   * Create Order
   */
  @Post()
  @Roles(Role.CUSTOMER)
  create(
    @GetUser('id') customerId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(customerId, dto);
  }

  /**
   * Customer
   * Get My Orders
   */
  @Get('my')
  @Roles(Role.CUSTOMER)
  findMyOrders(
    @GetUser('id') customerId: string,
  ) {
    return this.ordersService.findMyOrders(customerId);
  }

  /**
   * Restaurant Owner / Admin
   * Get Orders by Restaurant
   */
  @Get('restaurant')
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  findByRestaurant(
    @Query('restaurantId') restaurantId: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
  ) {
    return this.ordersService.findByRestaurant(
      restaurantId,
      requesterId,
      requesterRole,
    );
  }

  /**
   * Restaurant Owner / Admin
   * Get Orders by Branch
   */
  @Get('branch')
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  findByBranch(
    @Query('branchId') branchId: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
  ) {
    return this.ordersService.findByBranch(
      branchId,
      requesterId,
      requesterRole,
    );
  }

  /**
   * Rider
   * Get unclaimed, ready-for-pickup orders at my assigned branch
   */
  @Get('rider/available')
  @Roles(Role.RIDER)
  findAvailableForRider(@GetUser('id') riderId: string) {
    return this.ordersService.findAvailableForRider(riderId);
  }

  /**
   * Rider
   * Get orders I've claimed
   */
  @Get('rider/mine')
  @Roles(Role.RIDER)
  findMyDeliveries(@GetUser('id') riderId: string) {
    return this.ordersService.findMyDeliveries(riderId);
  }

  /**
   * Customer / Restaurant Owner / Admin / Branch Manager (own branch) /
   * Rider (assigned, or previewing an unclaimed ready order at their branch)
   * Get Order Details
   */
  @Get(':id')
  @Roles(
    Role.CUSTOMER,
    Role.RESTAURANT_OWNER,
    Role.ADMIN,
    Role.BRANCH_MANAGER,
    Role.RIDER,
  )
  findOne(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
  ) {
    return this.ordersService.findOne(
      id,
      requesterId,
      requesterRole,
    );
  }

  /**
   * Customer / Restaurant Owner / Admin / Branch Manager (own branch) /
   * Rider (assigned, or previewing an unclaimed ready order at their branch)
   * Get Order Status Timeline
   */
  @Get(':id/history')
  @Roles(
    Role.CUSTOMER,
    Role.RESTAURANT_OWNER,
    Role.ADMIN,
    Role.BRANCH_MANAGER,
    Role.RIDER,
  )
  getHistory(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
  ) {
    return this.ordersService.getStatusHistory(
      id,
      requesterId,
      requesterRole,
    );
  }

  /**
   * Restaurant Owner / Admin / Branch Manager (own branch, e.g. dine-in
   * orders) / Rider (assigned, pickup+delivery only — see
   * OrdersService.updateStatus for the rider-specific restriction)
   * Update Order Status
   */
  @Patch(':id/status')
  @Roles(
    Role.RESTAURANT_OWNER,
    Role.ADMIN,
    Role.BRANCH_MANAGER,
    Role.RIDER,
  )
  updateStatus(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(
      id,
      dto.status,
      requesterId,
      requesterRole,
    );
  }

  /**
   * Rider
   * Claim an unclaimed, ready-for-pickup order at my assigned branch
   */
  @Patch(':id/claim')
  @Roles(Role.RIDER)
  claim(
    @Param('id') id: string,
    @GetUser('id') riderId: string,
  ) {
    return this.ordersService.claimDelivery(id, riderId);
  }

  /**
   * Customer
   * Cancel Order
   */
  @Patch(':id/cancel')
  @Roles(Role.CUSTOMER)
  cancel(
    @Param('id') id: string,
    @GetUser('id') customerId: string,
  ) {
    return this.ordersService.cancelOrder(id, customerId);
  }
}