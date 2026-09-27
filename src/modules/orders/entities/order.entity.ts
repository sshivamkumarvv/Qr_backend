import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { RestaurantTable } from '../../tables/entities/table.entity';
import { OrderItem } from './order-item.entity'
import { OrderStatusHistory } from './order-status-history.entity';

import { OrderStatus } from '../../../common/enums/order-status.enum';
import { OrderType } from '../../../common/enums/order-type.enum';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { PaymentStatus } from 'src/common/enums/payment-status.enum';


@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Customer
  @ManyToOne(() => User, (user) => user.orders, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer!: User;

  @Column('uuid')
  customerId!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  customerName!: string;

  @Column({
    type: 'varchar',
    length: 15,
  })
  customerPhone!: string;

  // Restaurant
  @ManyToOne(() => Restaurant, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'restaurantId' })
  restaurant!: Restaurant;

  @Column('uuid')
  restaurantId!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  restaurantName!: string;

  // Branch
  @ManyToOne(() => Branch, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'branchId' })
  branch!: Branch;

  @Column('uuid')
  branchId!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  branchName!: string;

  // Order type — delivery (default, unchanged existing behavior) or
  // dine-in (QR/table ordering). See OrdersService.create for how each
  // is handled differently (pricing, no rider/delivery-address fields,
  // location verification).
  @Column({
    type: 'enum',
    enum: OrderType,
    default: OrderType.DELIVERY,
  })
  orderType!: OrderType;

  // Table — only set for dine-in orders. Nullable FK so a table can be
  // removed later without breaking historical orders; tableNumber is a
  // denormalized snapshot (same pattern as branchName/restaurantName
  // above) so the order still shows a sensible table label even if the
  // table row itself is gone.
  @ManyToOne(() => RestaurantTable, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'tableId' })
  table!: RestaurantTable | null;

  @Column({ type: 'uuid', nullable: true })
  tableId!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  tableNumber!: string | null;

  // Rider — set once a rider claims this order (see
  // OrdersService.claimDelivery). Null until then; only ever set for
  // orders that reach READY.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'riderId' })
  rider!: User | null;

  @Column({ type: 'uuid', nullable: true })
  riderId!: string | null;

  // Items
  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items!: OrderItem[];

  @OneToMany(
    () => OrderStatusHistory,
    (history) => history.order,
    {
      cascade: true,
    },
  )
  statusHistory!: OrderStatusHistory[];

  // Status
  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  // Payment
  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod!: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  paymentId!: string | null;

  // Razorpay order id, created up-front for ONLINE payments so the
  // client can open checkout with it. Distinct from paymentId, which
  // is the id of the actual successful payment/capture.
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  razorpayOrderId!: string | null;

  // Pricing
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  subtotal!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  taxAmount!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  deliveryFee!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  convenienceFee!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  discountAmount!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  totalAmount!: number;

  // Delivery Address Snapshot — null for dine-in orders (see orderType
  // above). Always populated for delivery orders, same as before.
  @Column({
    type: 'text',
    nullable: true,
  })
  deliveryAddress!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  deliveryCity!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  deliveryLandmark!: string | null;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  deliveryLatitude!: number | null;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  deliveryLongitude!: number | null;

  @Column({
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  branchDistanceKm!: number | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}