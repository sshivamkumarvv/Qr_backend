import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Branch } from '../../branches/entities/branch.entity';

// One row per physical table at a branch. qrToken is the opaque value
// printed/encoded in that table's QR code — deliberately not the row's
// own id, so a QR can be regenerated (new token) without needing a new
// table record, and so scanning a QR doesn't leak a raw database id.
@Index(['branchId', 'tableNumber'], { unique: true })
@Entity('restaurant_tables')
export class RestaurantTable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Branch, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branchId' })
  branch!: Branch;

  @Index()
  @Column('uuid')
  branchId!: string;

  // Human-facing label, e.g. "12", "A4", "Patio 3" — whatever's printed
  // on the physical table. Unique per branch (see the composite index
  // above), not globally.
  @Column({
    type: 'varchar',
    length: 20,
  })
  tableNumber!: string;

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 64,
  })
  qrToken!: string;

  @Column({
    default: true,
  })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
