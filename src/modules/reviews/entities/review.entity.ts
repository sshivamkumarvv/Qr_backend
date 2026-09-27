import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Order } from '../../orders/entities/order.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { User } from '../../users/entities/user.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // One review per order.
  @Index({ unique: true })
  @Column('uuid')
  orderId!: string;

  @ManyToOne(() => Order, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Column('uuid')
  customerId!: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer!: User;

  @Column({
    type: 'varchar',
    length: 100,
  })
  customerName!: string;

  @Index()
  @Column('uuid')
  restaurantId!: string;

  @ManyToOne(() => Restaurant, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'restaurantId' })
  restaurant!: Restaurant;

  @Column({
    type: 'smallint',
  })
  rating!: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  comment!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
