import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';

import { AdminService } from './admin.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

import { Role } from '../../common/enums/role.enum';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateRestaurantStatusDto } from './dto/update-restaurant-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) {}

  /**
   * Dashboard
   */
  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboardSummary();
  }

  /**
   * Revenue
   */
  @Get('revenue')
  revenue() {
    return this.adminService.getRevenueSummary();
  }

  /**
   * Orders Summary
   */
  @Get('orders/summary')
  orderSummary() {
    return this.adminService.getOrderSummary();
  }

  /**
   * Recent Orders
   */
  @Get('orders')
  orders() {
    return this.adminService.getOrders();
  }

  /**
   * Single Order
   */
  @Get('orders/:id')
  order(
    @Param('id') id: string,
  ) {
    return this.adminService.getOrder(id);
  }

  /**
   * Override Order Status (admin bypass — still enforces
   * valid state transitions)
   */
  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @GetUser('id') adminId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.adminService.updateOrderStatus(
      id,
      dto.status,
      adminId,
    );
  }

  /**
   * Customers
   */
  @Get('customers')
  customers() {
    return this.adminService.getCustomers();
  }

  /**
   * Recent Customers
   */
  @Get('customers/recent')
  recentCustomers() {
    return this.adminService.getRecentCustomers();
  }

  /**
   * Single Customer
   */
  @Get('customers/:id')
  customer(
    @Param('id') id: string,
  ) {
    return this.adminService.getCustomer(id);
  }

  /**
   * Activate / Deactivate Customer
   */
  @Patch('customers/:id/status')
  updateCustomerStatus(
    @Param('id') id: string,
    @Body()
    body: {
      isActive: boolean;
    },
  ) {
    return this.adminService.changeCustomerStatus(
      id,
      body.isActive,
    );
  }

  /**
   * Restaurants
   */
  @Get('restaurants')
  restaurants() {
    return this.adminService.getRestaurants();
  }

  @Patch('restaurants/:id/status')
  updateRestaurantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantStatusDto,
  ) {
    return this.adminService.changeRestaurantStatus(id, dto.isActive);
  }

  /**
   * Restaurant Details
   */
  @Get('restaurants/:id')
  restaurant(
    @Param('id') id: string,
  ) {
    return this.adminService.getRestaurant(id);
  }

  /**
   * Top Selling Items
   */
  @Get('top-selling-items')
  topSellingItems() {
    return this.adminService.getTopSellingItems();
  }

  /**
   * Branch Analytics
   */
  @Get('branches/analytics')
  branchAnalytics() {
    return this.adminService.getBranchAnalytics();
  }

  /**
   * Search Customers
   */
  @Get('search/customers')
  searchCustomers(
    @Query('q') query: string,
  ) {
    return this.adminService.searchCustomers(
      query,
    );
  }

  /**
   * Search Orders
   */
  @Get('search/orders')
  searchOrders(
    @Query('q') query: string,
  ) {
    return this.adminService.searchOrders(
      query,
    );
  }
}