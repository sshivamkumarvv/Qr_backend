import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { MenuItem } from '../../menu-items/entities/menu-item.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name!: string;

@Column({
  type: 'varchar',
  length: 100,
  nullable: true,
})
slug!: string | null;

@Column({
  type: 'text',
  nullable: true,
})
imageUrl!: string | null;

@Column({
  type: 'varchar',
  length: 20,
  default: '#F4A825',
})
color!: string;

  @Column({
    default: true,
  })
  isActive!: boolean;

  @Column({
    type: 'int',
    default: 0,
  })
  displayOrder!: number;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.categories, {
    nullable: false,
    onDelete: 'CASCADE',
  })


  @JoinColumn({ name: 'restaurantId' })
  restaurant!: Restaurant;

  @Index()
  @Column('uuid')
  restaurantId!: string;

  @OneToMany(() => MenuItem, (menuItem) => menuItem.category)
  menuItems!: MenuItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}