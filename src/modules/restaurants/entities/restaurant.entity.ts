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
import { Category } from 'src/modules/categories/entities/category.entity';
import { MenuItem } from '../../menu-items/entities/menu-item.entity';
// import { Order } from '../../orders/entities/order.entity';
import { Branch } from '../../branches/entities/branch.entity';

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @Column({ length: 255 })
  address!: string;

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
logoUrl!: string | null;

  @Column({
    type: 'decimal',
    precision: 2,
    scale: 1,
    default: 0,
  })
  rating!: number;

  @Column({
    default: true,
  })
  isActive!: boolean;

  // Optional per-restaurant pricing overrides.
  // Falls back to global config defaults when null.
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  baseDeliveryFee!: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  perKmDeliveryFee!: number | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  taxPercent!: number | null;

  // Flat percentage off the subtotal for dine-in orders (an alternative
  // or complement to per-item dineInPrice on MenuItem — a restaurant can
  // use one, the other, or both; using both stacks, so document that to
  // whoever configures this). Null means no dine-in discount.
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  dineInDiscountPercent!: number | null;

  @ManyToOne(() => User, (user) => user.restaurants, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column('uuid')
  ownerId!: string;

  @OneToMany(() => Category, (category) => category.restaurant)
  categories!: Category[];

  @OneToMany(() => MenuItem, (menuItem) => menuItem.restaurant)
  menuItems!: MenuItem[];

  // @OneToMany(() => Order, (order) => order.restaurant)
  // orders!: Order[];

  @OneToMany(() => Branch, (branch) => branch.restaurant)
  branches!: Branch[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}