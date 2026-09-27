import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Order } from './order.entity';
import { MenuItem } from '../../menu-items/entities/menu-item.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Column('uuid')
  orderId!: string;

  @ManyToOne(() => MenuItem, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'menuItemId' })
  menuItem!: MenuItem | null;

  @Column('uuid', {
    nullable: true,
  })
  menuItemId!: string | null;

  // Snapshot
  @Column({
    type: 'varchar',
    length: 150,
  })
  menuItemName!: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  menuItemImage!: string | null;

  @Column({
    default: false,
  })
  isVeg!: boolean;

  @Column({
    type: 'int',
  })
  quantity!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  unitPrice!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  totalPrice!: number;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  portion!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  specialInstructions!: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  customization!: Record<string, any> | null;
}