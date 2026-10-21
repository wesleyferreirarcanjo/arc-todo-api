import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('machines')
export class Machine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;

  @Column({ name: 'name' })
  name: string;

  /** SHA-256 hex of the `amt_…` plaintext shown once at connect time. */
  @Index()
  @Column({ name: 'token_hash' })
  tokenHash: string;

  /** Owner opt-in for remote control; off until the PC flips it on. */
  @Column({ name: 'remote_enabled', default: false })
  remoteEnabled: boolean;

  @Column({ name: 'paused', default: false })
  paused: boolean;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
