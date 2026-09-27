import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Restaurant } from '../../restaurants/entities/restaurant.entity';
// import { Order } from '../../orders/entities/order.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Example: "Koramangala", "Indiranagar", "Main Outlet"
  @Column({
    type: 'varchar',
    length: 100,
  })
  name!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  addressLine!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  city!: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  pincode!: string | null;

  @Column({
    type: 'double precision',
  })
  latitude!: number;

  @Column({
    type: 'double precision',
  })
  longitude!: number;

  @Column({
    type: 'varchar',
    length: 15,
    nullable: true,
  })
  phone!: string | null;

@Column({
  type: 'varchar',
  length: 500,
  nullable: true,
})
imageUrl!: string | null;

  @Column({
    default: true,
  })
  isActive!: boolean;

  // Whether this branch is currently accepting online orders
  @Column({
    default: true,
  })
  acceptingOrders!: boolean;

  // Delivery radius in kilometers
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  serviceRadiusKm!: number | null;

  // Opening time (24-hour format)
  @Column({
    type: 'time',
    nullable: true,
  })
  openingTime!: string | null;

  // Closing time (24-hour format)
  @Column({
    type: 'time',
    nullable: true,
  })
  closingTime!: string | null;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.branches, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'restaurantId' })
  restaurant!: Restaurant;

  @Column('uuid')
  restaurantId!: string;

  // Uncomment when Order entity is created
  // @OneToMany(() => Order, (order) => order.branch)
  // orders!: Order[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}