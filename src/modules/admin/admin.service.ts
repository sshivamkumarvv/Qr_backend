import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Category } from '../categories/entities/category.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';

import { OrderStatus } from '../../common/enums/order-status.enum';
import { Role } from '../../common/enums/role.enum';

import { OrdersService } from '../orders/orders.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { BranchesService } from '../branches/branches.service';
import { CategoriesService } from '../categories/categories.service';
import { MenuItemsService } from '../menu-items/menu-items.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,

    @InjectRepository(Restaurant)
    private readonly restaurantsRepository: Repository<Restaurant>,

    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,

    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,

    @InjectRepository(MenuItem)
    private readonly menuItemsRepository: Repository<MenuItem>,

    // private readonly ordersService: OrdersService,

    // private readonly restaurantsService: RestaurantsService,

    // private readonly branchesService: BranchesService,

    // private readonly categoriesService: CategoriesService,

    // private readonly menuItemsService: MenuItemsService,

    private readonly ordersService: OrdersService,
  ) {}

    async dashboard() {
    const [
      totalCustomers,
      totalOrders,
      totalRestaurants,
      totalBranches,
      totalCategories,
      totalMenuItems,
      pendingOrders,
      preparingOrders,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      this.usersRepository.count({
        where: {
          isActive: true,
        },
      }),

      this.ordersRepository.count(),

      this.restaurantsRepository.count({
        where: {
          isActive: true,
        },
      }),

      this.branchesRepository.count({
        where: {
          isActive: true,
        },
      }),

      this.categoriesRepository.count({
        where: {
          isActive: true,
        },
      }),

      this.menuItemsRepository.count({
        where: {
          isAvailable: true,
        },
      }),

      this.ordersRepository.count({
        where: {
          status: OrderStatus.PENDING,
        },
      }),

      this.ordersRepository.count({
        where: {
          status: OrderStatus.PREPARING,
        },
      }),

      this.ordersRepository.count({
        where: {
          status: OrderStatus.DELIVERED,
        },
      }),

      this.ordersRepository.count({
        where: {
          status: OrderStatus.CANCELLED,
        },
      }),
    ]);

    const revenue = await this.ordersRepository
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.totalAmount),0)', 'total')
      .where('order.status = :status', {
        status: OrderStatus.DELIVERED,
      })
      .getRawOne();

    const latestOrders =
      await this.ordersRepository.find({
        take: 10,
        order: {
          createdAt: 'DESC',
        },
      });

    return {
      statistics: {
        customers: totalCustomers,
        restaurants: totalRestaurants,
        branches: totalBranches,
        categories: totalCategories,
        menuItems: totalMenuItems,
        totalOrders,
        pendingOrders,
        preparingOrders,
        deliveredOrders,
        cancelledOrders,
        revenue: Number(revenue.total),
      },

      latestOrders,
    };
  }
    async getCustomers() {
    return this.usersRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getCustomer(id: string) {
    const customer =
      await this.usersRepository.findOne({
        where: {
          id,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found.',
      );
    }

    return customer;
  }

  async changeCustomerStatus(
    id: string,
    isActive: boolean,
  ) {
    const customer =
      await this.getCustomer(id);

    customer.isActive = isActive;

    return this.usersRepository.save(customer);
  }

async getRestaurant(id: string) {
  const restaurant = await this.restaurantsRepository.findOne({
    where: {
      id,
    },
    relations: {
      branches: true,
      categories: true,
      menuItems: true,
    },
  });

  if (!restaurant) {
    throw new NotFoundException('Restaurant not found.');
  }

  return restaurant;
}

  async getRestaurants() {
    return this.restaurantsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async changeRestaurantStatus(id: string, isActive: boolean) {
    const restaurant = await this.restaurantsRepository.findOne({
      where: { id },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }
    restaurant.isActive = isActive;
    return this.restaurantsRepository.save(restaurant);
  }

    async getOrders() {
    return this.ordersRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getOrder(id: string) {
    const order =
      await this.ordersRepository.findOne({
        where: {
          id,
        },
      });

    if (!order) {
      throw new NotFoundException(
        'Order not found.',
      );
    }

    return order;
  }

  /**
   * Admin override — bypasses restaurant-ownership checks
   * (still enforces the normal status-transition rules).
   */
  async updateOrderStatus(id: string, status: OrderStatus, adminId: string) {
    return this.ordersService.updateStatus(
      id,
      status,
      adminId,
      Role.ADMIN,
    );
  }
    async getRecentCustomers(limit = 10) {
    return this.usersRepository.find({
      where: {
        isActive: true,
      },
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  async getRecentOrders(limit = 10) {
    return this.ordersRepository.find({
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  async getRevenueSummary() {
    const delivered = await this.ordersRepository
      .createQueryBuilder('order')
      .select('COUNT(*)', 'totalOrders')
      .addSelect(
        'COALESCE(SUM(order.totalAmount),0)',
        'totalRevenue',
      )
      .where('order.status = :status', {
        status: OrderStatus.DELIVERED,
      })
      .getRawOne();

    return {
      totalOrders: Number(delivered.totalOrders),
      totalRevenue: Number(delivered.totalRevenue),
    };
  }

  async getOrderSummary() {
    const orders = await this.ordersRepository.find();

    return {
      total: orders.length,
      pending: orders.filter(
        (o) => o.status === OrderStatus.PENDING,
      ).length,

      confirmed: orders.filter(
        (o) => o.status === OrderStatus.CONFIRMED,
      ).length,

      preparing: orders.filter(
        (o) => o.status === OrderStatus.PREPARING,
      ).length,

      ready: orders.filter(
        (o) => o.status === OrderStatus.READY,
      ).length,

      outForDelivery: orders.filter(
        (o) =>
          o.status ===
          OrderStatus.OUT_FOR_DELIVERY,
      ).length,

      delivered: orders.filter(
        (o) => o.status === OrderStatus.DELIVERED,
      ).length,

      cancelled: orders.filter(
        (o) => o.status === OrderStatus.CANCELLED,
      ).length,
    };
  }

  async getTopSellingItems() {
    const orders = await this.ordersRepository.find();

    const items = new Map<
      string,
      {
        menuItemId: string | null;
        name: string;
        quantity: number;
        revenue: number;
      }
    >();

    for (const order of orders) {
      if (order.status !== OrderStatus.DELIVERED) {
        continue;
      }

      for (const item of order.items) {
        const existing = items.get(
          item.menuItemName,
        );

        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue +=
            Number(item.totalPrice);
        } else {
          items.set(item.menuItemName, {
            menuItemId: item.menuItemId,
            name: item.menuItemName,
            quantity: item.quantity,
            revenue: Number(item.totalPrice),
          });
        }
      }
    }

    return [...items.values()]
      .sort(
        (a, b) => b.quantity - a.quantity,
      )
      .slice(0, 10);
  }

  async getBranchAnalytics() {
    const branches =
      await this.branchesRepository.find({
        where: {
          isActive: true,
        },
      });

    return Promise.all(
      branches.map(async (branch) => {
        const orders =
          await this.ordersRepository.count({
            where: {
              branchId: branch.id,
            },
          });

        return {
          id: branch.id,
          name: branch.name,
          totalOrders: orders,
        };
      }),
    );
  }

  async searchCustomers(search: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .where(
        'LOWER(user.fullName) LIKE LOWER(:search)',
        {
          search: `%${search}%`,
        },
      )
      .orWhere(
        'LOWER(user.phone) LIKE LOWER(:search)',
        {
          search: `%${search}%`,
        },
      )
      .getMany();
  }

  async searchOrders(search: string) {
    return this.ordersRepository
      .createQueryBuilder('order')
      .where('order.id ILIKE :search', {
        search: `%${search}%`,
      })
      .orWhere(
        'LOWER(order.customerName) LIKE LOWER(:search)',
        {
          search: `%${search}%`,
        },
      )
      .orderBy(
        'order.createdAt',
        'DESC',
      )
      .getMany();
  }

  async dashboardSummary() {
    const [
      dashboard,
      revenue,
      orderSummary,
      topItems,
      branchAnalytics,
    ] = await Promise.all([
      this.dashboard(),
      this.getRevenueSummary(),
      this.getOrderSummary(),
      this.getTopSellingItems(),
      this.getBranchAnalytics(),
    ]);

    return {
      ...dashboard,
      revenue,
      orderSummary,
      topSellingItems: topItems,
      branches: branchAnalytics,
    };
  }
}