import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';

import { User } from '../users/entities/user.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { Branch } from '../branches/entities/branch.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';
import { Address } from '../addresses/entities/address.entity';
import { RestaurantTable } from '../tables/entities/table.entity';

import { OrderStatus } from '../../common/enums/order-status.enum';
import { OrderType } from '../../common/enums/order-type.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { Role } from '../../common/enums/role.enum';

import { BranchesService } from '../branches/branches.service';
import { TablesService } from '../tables/tables.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersGateway } from './gateway/orders.gateway';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Restaurant)
    private readonly restaurantsRepository: Repository<Restaurant>,

    @InjectRepository(MenuItem)
    private readonly menuItemsRepository: Repository<MenuItem>,

    @InjectRepository(Address)
    private readonly addressesRepository: Repository<Address>,

    private readonly branchesService: BranchesService,

    private readonly tablesService: TablesService,

    private readonly configService: ConfigService,

    private readonly ordersGateway: OrdersGateway,

    private readonly dataSource: DataSource,
  ) {}

  async create(
    customerId: string,
    dto: CreateOrderDto,
  ): Promise<Order> {
    const customer = await this.usersRepository.findOne({
      where: {
        id: customerId,
        isActive: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    if (!customer.fullName) {
      throw new BadRequestException(
        'Please complete your profile before placing an order.',
      );
    }

    const restaurant = await this.restaurantsRepository.findOne({
      where: {
        id: dto.restaurantId,
        isActive: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    const orderType = dto.orderType ?? OrderType.DELIVERY;

    let branch: Branch;
    let distanceKm: number | null = null;
    let deliveryPoint: {
      addressLine: string;
      city: string | null;
      landmark: string | null;
      latitude: number;
      longitude: number;
    } | null = null;
    let table: RestaurantTable | null = null;

    if (orderType === OrderType.DINE_IN) {
      table = await this.tablesService.findActiveTableOrThrow({
        token: dto.tableToken,
        branchId: dto.dineInBranchId,
        tableNumber: dto.tableNumber,
      });

      if (table.branch.restaurantId !== restaurant.id) {
        throw new BadRequestException(
          'This table does not belong to the selected restaurant.',
        );
      }

      if (!table.branch.isActive || !table.branch.acceptingOrders) {
        throw new BadRequestException(
          'This branch is not accepting orders right now.',
        );
      }

      // Authoritative check — never trust the client's word that
      // they're actually on-site. See TablesService.assertCustomerAtBranch.
      this.tablesService.assertCustomerAtBranch(
        table,
        dto.latitude,
        dto.longitude,
      );

      branch = table.branch;
    } else {
      deliveryPoint = await this.resolveDeliveryPoint(
        customerId,
        dto,
      );

      const nearest = await this.branchesService.findNearest(
        restaurant.id,
        deliveryPoint.latitude,
        deliveryPoint.longitude,
      );

      branch = nearest.branch;
      distanceKm = nearest.distanceKm;
    }

    const order = await this.dataSource.transaction(
      async (manager) => {
        const menuItemIds = dto.items.map(
          (item) => item.menuItemId,
        );

        const menuItems = await manager.find(MenuItem, {
          where: {
            id: In(menuItemIds),
            restaurantId: restaurant.id,
            isAvailable: true,
          },
          relations: { addOns: true },
        });

        if (menuItems.length !== menuItemIds.length) {
          throw new BadRequestException(
            'One or more menu items are invalid.',
          );
        }

        let subtotal = 0;

        const orderItems: OrderItem[] = [];

        for (const input of dto.items) {
          const menuItem = menuItems.find(
            (m) => m.id === input.menuItemId,
          );

          if (!menuItem) {
            throw new BadRequestException(
              'Menu item not found.',
            );
          }

          // Stock check — lock the row so two concurrent orders
          // can't both succeed against the same last few units.
          if (menuItem.trackInventory) {
            const locked = await manager.findOne(MenuItem, {
              where: { id: menuItem.id },
              lock: { mode: 'pessimistic_write' },
            });

            const available = locked?.stockQuantity ?? 0;

            if (!locked || available < input.quantity) {
              throw new BadRequestException(
                `${menuItem.name} is out of stock.`,
              );
            }

            locked.stockQuantity = available - input.quantity;

            await manager.save(MenuItem, locked);
          }

          let unitPrice = Number(
            orderType === OrderType.DINE_IN
              ? (menuItem.dineInPrice ?? menuItem.discountedPrice ?? menuItem.price)
              : (menuItem.discountedPrice ?? menuItem.price),
          );

          if (input.portion?.toLowerCase() === 'half') {
            unitPrice = Math.round(unitPrice * 0.6);
          }

          const selectedAddOnIds = input.addOnIds ?? [];
          const selectedAddOns = selectedAddOnIds.map((addOnId) => {
            const addon = menuItem.addOns.find(
              (candidate) => candidate.id === addOnId && candidate.isAvailable,
            );
            if (!addon) {
              throw new BadRequestException(
                `An add-on selected for ${menuItem.name} is unavailable.`,
              );
            }
            return addon;
          });
          const addOnTotal = selectedAddOns.reduce(
            (sum, addon) => sum + Number(addon.price),
            0,
          );
          unitPrice += addOnTotal;

          const totalPrice = Number((unitPrice * input.quantity).toFixed(2));

          subtotal += totalPrice;

          orderItems.push(
            manager.create(OrderItem, {
              menuItemId: menuItem.id,

              menuItemName: menuItem.name,
              menuItemImage: menuItem.imageUrl,
              isVeg: menuItem.isVeg,

              quantity: input.quantity,

              unitPrice,
              totalPrice,
              portion: input.portion ?? null,
              specialInstructions: input.specialInstructions ?? null,
              customization: selectedAddOns.length
                ? {
                    addOns: selectedAddOns.map((addon) => ({
                      id: addon.id,
                      name: addon.name,
                      price: Number(addon.price),
                    })),
                  }
                : input.customization ?? null,
            }),
          );
        }

        const deliveryFee =
          orderType === OrderType.DINE_IN
            ? 0
            : this.calculateDeliveryFee(restaurant, distanceKm ?? 0);

        const platformFeePercent =
          restaurant.platformFeePercent != null
            ? Number(restaurant.platformFeePercent)
            : Number(this.configService.get<number>('pricing.platformFeePercent') ?? 5);

        let convenienceFee = 0;
        let taxAmount = 0;

        if (orderType === OrderType.DINE_IN) {
          // Table QR Ordering SaaS model:
          // Menu item prices are food GST inclusive.
          // Platform Convenience Fee = platformFeePercent% of subtotal (e.g. 5% of 1000 = ₹50).
          // GST on Platform Convenience Fee = 18% of the platform fee (e.g. 18% of 50 = ₹9).
          const basePlatformFee = Number(((subtotal * platformFeePercent) / 100).toFixed(2));
          const gstOnPlatformFee = Number(((basePlatformFee * 18) / 100).toFixed(2));
          convenienceFee = basePlatformFee;
          taxAmount = gstOnPlatformFee;
        } else {
          taxAmount = this.calculateTax(
            restaurant,
            subtotal,
          );
          convenienceFee = Number(((subtotal * platformFeePercent) / 100).toFixed(2));
        }

        const discountAmount =
          orderType === OrderType.DINE_IN &&
          restaurant.dineInDiscountPercent != null
            ? Number(
                (
                  (subtotal * Number(restaurant.dineInDiscountPercent)) /
                  100
                ).toFixed(2),
              )
            : 0;

        const totalAmount = Number(
          (subtotal + deliveryFee + convenienceFee + taxAmount - discountAmount).toFixed(2),
        );

        // Revenue Split calculation:
        // Platform share = platform convenience fee (5%) + GST on platform fee (18%)
        // (Platform retains the 5% SaaS commission + remits the 18% GST collected)
        // Restaurant share = food subtotal - discount + any delivery fee
        const platformShare = Number((convenienceFee + taxAmount).toFixed(2));
        const restaurantShare = Number((totalAmount - platformShare).toFixed(2));

        const newOrder = new Order();

        newOrder.customerId = customer.id;
        newOrder.customerName = customer.fullName as string;
        newOrder.customerPhone = customer.phone;

        newOrder.restaurantId = restaurant.id;
        newOrder.restaurantName = restaurant.name;

        newOrder.branchId = branch.id;
        newOrder.branchName = branch.name;

        newOrder.orderType = orderType;

        newOrder.status = OrderStatus.PENDING;

        newOrder.paymentMethod =
          dto.paymentMethod ?? PaymentMethod.COD;

        newOrder.paymentStatus = PaymentStatus.PENDING;

        newOrder.subtotal = subtotal;
        newOrder.deliveryFee = deliveryFee;
        newOrder.convenienceFee = convenienceFee;
        newOrder.taxAmount = taxAmount;
        newOrder.discountAmount = discountAmount;
        newOrder.totalAmount = totalAmount;

        newOrder.platformFeePercent = platformFeePercent;
        newOrder.platformShare = platformShare;
        newOrder.restaurantShare = restaurantShare;
        newOrder.settlementStatus = 'PENDING';
        newOrder.splitDetails = JSON.stringify({
          platformFeePercent,
          basePlatformFee: convenienceFee,
          gstPercent: 18,
          gstOnPlatformFee: taxAmount,
          platformShare,
          restaurantShare,
          subtotal,
          convenienceFee,
          taxAmount,
          totalAmount,
          currency: 'INR',
          calculatedAt: new Date().toISOString(),
          payoutStatus: 'PENDING',
        });

        if (orderType === OrderType.DINE_IN && table) {
          newOrder.tableId = table.id;
          newOrder.tableNumber = table.tableNumber;

          newOrder.deliveryAddress = null;
          newOrder.deliveryCity = null;
          newOrder.deliveryLandmark = null;
          newOrder.deliveryLatitude = null;
          newOrder.deliveryLongitude = null;
          newOrder.branchDistanceKm = null;
        } else if (deliveryPoint) {
          newOrder.tableId = null;
          newOrder.tableNumber = null;

          newOrder.deliveryAddress = deliveryPoint.addressLine;
          newOrder.deliveryCity = deliveryPoint.city ?? null;
          newOrder.deliveryLandmark = deliveryPoint.landmark ?? null;

          newOrder.deliveryLatitude = deliveryPoint.latitude;
          newOrder.deliveryLongitude = deliveryPoint.longitude;

          newOrder.branchDistanceKm = distanceKm ?? null;
        }

        newOrder.notes = dto.notes ?? null;

        newOrder.items = orderItems;

        const savedOrder = await manager.save(Order, newOrder);

        await manager.save(
          OrderStatusHistory,
          manager.create(OrderStatusHistory, {
            orderId: savedOrder.id,
            status: OrderStatus.PENDING,
            changedBy: null,
            note:
              orderType === OrderType.DINE_IN
                ? `Dine-in order placed at table ${table?.tableNumber}.`
                : 'Order placed.',
          }),
        );

        return savedOrder;
      },
    );

    this.ordersGateway.emitOrderCreated(order);

    return order;
  }

  /**
   * Base delivery fee + per-km rate. Uses the restaurant's own
   * pricing if set, otherwise falls back to platform defaults.
   */
  private calculateDeliveryFee(
    restaurant: Restaurant,
    distanceKm: number,
  ): number {
    const baseFee =
      restaurant.baseDeliveryFee != null
        ? Number(restaurant.baseDeliveryFee)
        : this.configService.get<number>(
            'pricing.baseDeliveryFee',
          )!;

    const perKmFee =
      restaurant.perKmDeliveryFee != null
        ? Number(restaurant.perKmDeliveryFee)
        : this.configService.get<number>(
            'pricing.perKmDeliveryFee',
          )!;

    return Number(
      (baseFee + perKmFee * distanceKm).toFixed(2),
    );
  }

  private calculateTax(
    restaurant: Restaurant,
    subtotal: number,
  ): number {
    const taxRatePercent =
      restaurant.taxPercent != null
        ? Number(restaurant.taxPercent)
        : this.configService.get<number>(
            'pricing.taxPercent',
          )!;

    return Number(
      ((subtotal * taxRatePercent) / 100).toFixed(2),
    );
  }

  private async resolveDeliveryPoint(
    customerId: string,
    dto: CreateOrderDto,
  ): Promise<{
    addressLine: string;
    city: string | null;
    landmark: string | null;
    latitude: number;
    longitude: number;
  }> {
    if (dto.addressId) {
      const address = await this.addressesRepository.findOne({
        where: {
          id: dto.addressId,
        },
      });

      if (!address) {
        throw new NotFoundException(
          'Delivery address not found.',
        );
      }

      if (address.userId !== customerId) {
        throw new ForbiddenException(
          'This address does not belong to you.',
        );
      }

      return {
        addressLine: address.addressLine,
        city: address.city ?? null,
        landmark: address.landmark ?? null,
        latitude: address.latitude,
        longitude: address.longitude,
      };
    }

    if (
      dto.deliveryAddress &&
      dto.latitude != null &&
      dto.longitude != null
    ) {
      return {
        addressLine: dto.deliveryAddress,
        city: dto.city ?? null,
        landmark: dto.landmark ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
      };
    }

    throw new BadRequestException(
      'Provide either addressId or a complete delivery address.',
    );
  }

  async findMyOrders(customerId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: {
        customerId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findByRestaurant(
    restaurantId: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<Order[]> {
    const restaurant = await this.restaurantsRepository.findOne({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    if (
      requesterRole !== Role.ADMIN &&
      restaurant.ownerId !== requesterId
    ) {
      throw new ForbiddenException(
        'You do not have permission to view these orders.',
      );
    }

    return this.ordersRepository.find({
      where: {
        restaurantId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findByBranch(
    branchId: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<Order[]> {
    const branch = await this.branchesService.findOne(branchId);

    if (
      requesterRole !== Role.ADMIN &&
      branch.restaurant.ownerId !== requesterId
    ) {
      throw new ForbiddenException(
        'You do not have permission to view these orders.',
      );
    }

    return this.ordersRepository.find({
      where: {
        branchId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(
    id: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: {
        id,
      },
      relations: {
        restaurant: true,
        branch: true,
        statusHistory: true,
      },
      order: {
        statusHistory: {
          createdAt: 'ASC',
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    const isCustomer = order.customerId === requesterId;

    const isRestaurantOwner =
      order.restaurant.ownerId === requesterId;

    const isAdmin = requesterRole === Role.ADMIN;

    const isAssignedRider =
      requesterRole === Role.RIDER &&
      order.riderId === requesterId;

    let isBranchManagerHere = false;

    if (requesterRole === Role.BRANCH_MANAGER) {
      const manager = await this.usersRepository.findOne({
        where: { id: requesterId },
      });

      isBranchManagerHere =
        !!manager?.assignedBranchId &&
        manager.assignedBranchId === order.branchId;
    }

    // A rider also needs to see an order's details BEFORE claiming it
    // (from the "available deliveries" list) — allowed only if it's
    // still unclaimed, ready for pickup, and at their assigned branch.
    let canRiderPreviewUnclaimed = false;

    if (
      requesterRole === Role.RIDER &&
      !order.riderId &&
      order.status === OrderStatus.READY
    ) {
      const rider = await this.usersRepository.findOne({
        where: { id: requesterId },
      });

      canRiderPreviewUnclaimed =
        !!rider?.assignedBranchId &&
        rider.assignedBranchId === order.branchId;
    }

    if (
      !isCustomer &&
      !isRestaurantOwner &&
      !isAdmin &&
      !isAssignedRider &&
      !canRiderPreviewUnclaimed &&
      !isBranchManagerHere
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this order.',
      );
    }

    return order;
  }

  async getStatusHistory(
    id: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<OrderStatusHistory[]> {
    const order = await this.findOne(id, requesterId, requesterRole);

    return order.statusHistory;
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    requesterId: string,
    requesterRole: Role,
  ): Promise<Order> {
    const order = await this.dataSource.transaction(
      async (manager) => {
        const existing = await manager.findOne(Order, {
          where: { id },
          relations: { restaurant: true },
        });

        if (!existing) {
          throw new NotFoundException('Order not found.');
        }

        const isOwner =
          existing.restaurant.ownerId === requesterId;

        const isAdmin = requesterRole === Role.ADMIN;

        let isBranchManagerHere = false;

        if (requesterRole === Role.BRANCH_MANAGER) {
          const manager = await this.usersRepository.findOne({
            where: { id: requesterId },
          });

          isBranchManagerHere =
            !!manager?.assignedBranchId &&
            manager.assignedBranchId === existing.branchId;
        }

        // A rider may only touch orders they've claimed themselves —
        // see claimDelivery() below for how riderId gets set.
        const isAssignedRider =
          requesterRole === Role.RIDER &&
          existing.riderId === requesterId;

        if (!isOwner && !isAdmin && !isBranchManagerHere && !isAssignedRider) {
          throw new ForbiddenException(
            'You do not have permission to update this order.',
          );
        }

        // Even an assigned rider only owns the pickup/delivery stages —
        // they shouldn't be able to confirm/prepare an order just
        // because validateStatusTransition() would otherwise allow it.
        if (isAssignedRider && !isOwner && !isAdmin) {
          const riderAllowedTargets = [
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELIVERED,
          ];

          if (!riderAllowedTargets.includes(status)) {
            throw new ForbiddenException(
              'Riders can only mark an order out for delivery or delivered.',
            );
          }
        }

        this.validateStatusTransition(existing.status, status, existing.orderType);

        if (status === OrderStatus.CANCELLED) {
          await this.restoreStock(manager, existing.id);
        }

        existing.status = status;

        const saved = await manager.save(Order, existing);

        await manager.save(
          OrderStatusHistory,
          manager.create(OrderStatusHistory, {
            orderId: saved.id,
            status,
            changedBy: requesterId,
          }),
        );

        return saved;
      },
    );

    this.ordersGateway.emitStatusUpdate(order);

    return order;
  }

  /**
   * Rider
   * Self-claim an unclaimed order that's ready for pickup at the
   * rider's assigned branch. Uses a row lock so two riders racing to
   * claim the same order can't both succeed.
   */
  async claimDelivery(id: string, riderId: string): Promise<Order> {
    const order = await this.dataSource.transaction(
      async (manager) => {
        const rider = await manager.findOne(User, {
          where: { id: riderId },
        });

        if (!rider || rider.role !== Role.RIDER) {
          throw new ForbiddenException(
            'Only riders can claim deliveries.',
          );
        }

        if (!rider.assignedBranchId) {
          throw new BadRequestException(
            "You aren't assigned to a branch yet. Ask your branch manager to assign you before claiming deliveries.",
          );
        }

        const existing = await manager.findOne(Order, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!existing) {
          throw new NotFoundException('Order not found.');
        }

        if (existing.branchId !== rider.assignedBranchId) {
          throw new ForbiddenException(
            'This order is not from your assigned branch.',
          );
        }

        if (existing.status !== OrderStatus.READY) {
          throw new BadRequestException(
            'Only orders that are ready for pickup can be claimed.',
          );
        }

        if (existing.riderId) {
          throw new ConflictException(
            'This order has already been claimed by another rider.',
          );
        }

        existing.riderId = riderId;

        const saved = await manager.save(Order, existing);

        await manager.save(
          OrderStatusHistory,
          manager.create(OrderStatusHistory, {
            orderId: saved.id,
            status: saved.status,
            changedBy: riderId,
            note: 'Claimed by rider.',
          }),
        );

        return saved;
      },
    );

    this.ordersGateway.emitStatusUpdate(order);

    return order;
  }

  /**
   * Rider
   * Unclaimed, ready-for-pickup orders at this rider's assigned branch.
   */
  async findAvailableForRider(riderId: string): Promise<Order[]> {
    const rider = await this.usersRepository.findOne({
      where: { id: riderId },
    });

    if (!rider || rider.role !== Role.RIDER) {
      throw new ForbiddenException(
        'Only riders can view available deliveries.',
      );
    }

    if (!rider.assignedBranchId) {
      return [];
    }

    return this.ordersRepository.find({
      where: {
        branchId: rider.assignedBranchId,
        status: OrderStatus.READY,
        riderId: IsNull(),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Rider
   * Every order this rider has claimed, most recent first.
   */
  async findMyDeliveries(riderId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: {
        riderId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Customer
   * Cancel own order — only while it's still early in the
   * pipeline (before the restaurant starts preparing it).
   */
  async cancelOrder(
    id: string,
    customerId: string,
  ): Promise<Order> {
    const order = await this.dataSource.transaction(
      async (manager) => {
        const existing = await manager.findOne(Order, {
          where: { id },
        });

        if (!existing) {
          throw new NotFoundException('Order not found.');
        }

        if (existing.customerId !== customerId) {
          throw new ForbiddenException(
            'You do not have permission to cancel this order.',
          );
        }

        if (
          ![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(
            existing.status,
          )
        ) {
          throw new BadRequestException(
            'This order can no longer be cancelled. Please contact the restaurant.',
          );
        }

        await this.restoreStock(manager, existing.id);

        existing.status = OrderStatus.CANCELLED;

        const saved = await manager.save(Order, existing);

        await manager.save(
          OrderStatusHistory,
          manager.create(OrderStatusHistory, {
            orderId: saved.id,
            status: OrderStatus.CANCELLED,
            changedBy: customerId,
            note: 'Cancelled by customer.',
          }),
        );

        return saved;
      },
    );

    this.ordersGateway.emitStatusUpdate(order);

    return order;
  }

  /**
   * Restore stock quantities for any tracked items on an order
   * that's being cancelled. Called from within the same
   * transaction as the status change.
   */
  private async restoreStock(
    manager: import('typeorm').EntityManager,
    orderId: string,
  ): Promise<void> {
    const items = await manager.find(OrderItem, {
      where: { orderId },
    });

    for (const item of items) {
      if (!item.menuItemId) {
        continue;
      }

      const menuItem = await manager.findOne(MenuItem, {
        where: { id: item.menuItemId },
        lock: { mode: 'pessimistic_write' },
      });

      if (menuItem?.trackInventory) {
        menuItem.stockQuantity =
          (menuItem.stockQuantity ?? 0) + item.quantity;

        await manager.save(MenuItem, menuItem);
      }
    }
  }

  private validateStatusTransition(
    current: OrderStatus,
    next: OrderStatus,
    orderType: OrderType,
  ): void {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
      ],

      [OrderStatus.CONFIRMED]: [
        OrderStatus.PREPARING,
        OrderStatus.CANCELLED,
      ],

      [OrderStatus.PREPARING]: [OrderStatus.READY],

      // Dine-in has no rider/delivery leg — branch staff mark it served
      // directly. Delivery orders still have to go through a rider via
      // out_for_delivery (see updateStatus's rider-ownership check).
      [OrderStatus.READY]:
        orderType === OrderType.DINE_IN
          ? [OrderStatus.DELIVERED]
          : [OrderStatus.OUT_FOR_DELIVERY],

      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],

      [OrderStatus.DELIVERED]: [],

      [OrderStatus.CANCELLED]: [],
    };

    if (!transitions[current].includes(next)) {
      throw new BadRequestException(
        `Cannot change order status from ${current} to ${next}.`,
      );
    }
  }
}
