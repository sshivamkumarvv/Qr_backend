import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { MenuItem } from './menu-item.entity';

@Index(['restaurantId', 'name'], { unique: true })
@Entity('menu_addons')
export class MenuAddon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ default: true })
  isAvailable!: boolean;

  @ManyToOne(() => Restaurant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant!: Restaurant;

  @Index()
  @Column('uuid')
  restaurantId!: string;

  @ManyToMany(() => MenuItem, (menuItem) => menuItem.addOns)
  menuItems!: MenuItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}