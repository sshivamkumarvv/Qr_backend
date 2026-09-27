import { User } from "src/modules/users/entities/user.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column('uuid')
  userId!: string;

  // bcrypt/argon2 hash
  @Column({
    type: 'text',
  })
  refreshTokenHash!: string;

@Column({
  type: 'varchar',
  length: 150,
})
deviceId!: string;

@Column({
  type: 'varchar',
  length: 100,
  nullable: true,
})
deviceName!: string | null;

@Column({
  type: 'varchar',
  length: 50,
  nullable: true,
})
platform!: string | null;

@Column({
  type: 'varchar',
  length: 20,
  nullable: true,
})
appVersion!: string | null;

@Column({
  type: 'varchar',
  length: 255,
  nullable: true,
})
pushToken!: string | null;

@Column({
  type: 'varchar',
  length: 45,
  nullable: true,
})
ipAddress!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  userAgent!: string | null;

  @Column({
    default: false,
  })
  isRevoked!: boolean;

  @Column({
    type: 'timestamp',
  })
  expiresAt!: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lastUsedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}