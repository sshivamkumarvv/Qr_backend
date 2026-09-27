import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('otps')
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  phone!: string;

  // bcrypt hash of the 6-digit code — never store the plain code
  @Column()
  codeHash!: string;

  @Column()
  expiresAt!: Date;

  @Column({ default: false })
  isUsed!: boolean;

  @Column({ default: 0 })
  attempts!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
