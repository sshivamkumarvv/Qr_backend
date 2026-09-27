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

import { Role } from '../../../common/enums/role.enum';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { Order } from '../../orders/entities/order.entity';
import { Address } from '../../addresses/entities/address.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { UserSession } from 'src/modules/user-sessions/entities/user-session.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  fullName!: string | null;

  @Column({
    type: 'varchar',
    length: 15,
    unique: true,
  })
  phone!: string;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  email!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  address!: string | null;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.CUSTOMER,
  })
  role!: Role;

  @Column({
    default: true,
  })
  isActive!: boolean;

  // Only meaningful for branch-scoped roles (RIDER, BRANCH_MANAGER) — see
  // BRANCH_SCOPED_ROLES in role.enum.ts. Which branch this user is
  // currently working out of — set via
  // PATCH /users/:id/assign-branch (restaurant owner / admin). For a
  // rider this scopes "available deliveries"; for a branch manager this
  // scopes which branch's menu items they're allowed to edit.
  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedBranchId' })
  assignedBranch?: Branch | null;

  @Column({ type: 'uuid', nullable: true })
  assignedBranchId!: string | null;

  @OneToMany(() => Restaurant, (restaurant) => restaurant.owner)
  restaurants!: Restaurant[];

  @OneToMany(() => Order, (order) => order.customer)
  orders!: Order[];

  // Orders this user is delivering, when role === RIDER.
  @OneToMany(() => Order, (order) => order.rider)
  deliveries!: Order[];

  @OneToMany(() => Address, (address) => address.user)
  addresses!:Address[]

  @OneToMany(
  () => UserSession,
  (session) => session.user,
)
sessions!: UserSession[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
