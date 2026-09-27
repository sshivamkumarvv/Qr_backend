import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Order } from './order.entity';
import { OrderStatus } from '../../../common/enums/order-status.enum';

@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Column('uuid')
  orderId!: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
  })
  status!: OrderStatus;

  // Who caused this transition. Null for system-generated
  // entries (e.g. the initial PENDING row created with the order).
  @Column({
    type: 'uuid',
    nullable: true,
  })
  changedBy!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  note!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
