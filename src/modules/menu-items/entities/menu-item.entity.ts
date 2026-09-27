import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { Category } from '../../categories/entities/category.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { MenuAddon } from './menu-addon.entity';


@Index(['restaurantId', 'name'], { unique: true })
@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 150 })
  name!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  price!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  discountedPrice!: number | null;

  // Optional dine-in-specific price. Menus for QR/table ordering are
  // often priced differently from delivery (no packaging/delivery-fee
  // cross-subsidy baked in, sometimes cheaper to encourage dine-in).
  // Null means: use price/discountedPrice for dine-in too, same as
  // delivery. See OrdersService.create for how this is applied.
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  dineInPrice!: number | null;

@Column({
  type: 'varchar',
  length: 500,
  nullable: true,
})
imageUrl!: string | null;

  @Column({
    default: true,
  })
  isAvailable!: boolean;

  @Column({
    default: false,
  })
  isVeg!: boolean;

  @Column({
    default: false,
  })
  isFeatured!: boolean;

  @Column({
    default: true,
  })
  isCustomizable!: boolean;

  // Inventory (optional). When trackInventory is false (default),
  // the item has unlimited stock, same as before this field existed.
  @Column({
    default: false,
  })
  trackInventory!: boolean;

  @Column({
    type: 'int',
    nullable: true,
  })
  stockQuantity!: number | null;

@Column({
  type: 'int',
  default: 0,
})
displayOrder!: number;

  @Column({
    type: 'int',
    default: 15,
  })
  preparationTime!: number;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.menuItems, {
    nullable: false,
    onDelete: 'CASCADE',
  })
@JoinColumn({ name: 'restaurantId' })
  restaurant!: Restaurant;

  @Index()
  @Column('uuid')
  restaurantId!: string;

  @ManyToOne(() => Category, (category) => category.menuItems, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'categoryId' })
  category!: Category | null;

  @Index()
  @Column('uuid', {
    nullable: true,
  })
  categoryId!: string | null;

  // Branch scoping — null means this item is part of the restaurant's
  // shared menu (available at every branch). Set means it's specific to
  // one branch (added/managed by that branch's manager). Deliberately
  // NOT reusing categories for this — categories stay restaurant-wide
  // organizational groupings regardless of branch.
  @ManyToOne(() => Branch, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branchId' })
  branch!: Branch | null;

  @Index()
  @Column('uuid', {
    nullable: true,
  })
  branchId!: string | null;

  @ManyToMany(() => MenuAddon, (addon) => addon.menuItems)
  @JoinTable({
    name: 'menu_item_addons',
    joinColumn: { name: 'menuItemId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'menuAddonId', referencedColumnName: 'id' },
  })
  addOns!: MenuAddon[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}