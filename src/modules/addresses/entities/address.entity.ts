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

import { AddressLabel } from '../../../common/enums/address-label.enum';
import { User } from '../../users/entities/user.entity';

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // The relation User.addresses is declared as
  // @OneToMany(() => Address, (address) => address.user), so the inverse
  // side needs an actual `user` relation property here — a plain userId
  // column alone doesn't satisfy that. Keeping the FK column explicit
  // (rather than only the relation) is what lets AddressesService keep
  // querying/filtering by userId directly without an extra join.
  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index()
  @Column()
  userId!: string;

  @Column({ type: 'enum', enum: AddressLabel, nullable: true })
  label?: AddressLabel;

  @Column()
  addressLine!: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ nullable: true })
  landmark?: string;

  @Column({ default: false })
  isDefault!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}