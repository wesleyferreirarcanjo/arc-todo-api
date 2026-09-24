import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('desktop_auth_sessions')
export class DesktopAuthSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'state_hash' })
  stateHash: string;

  @Column({ name: 'code_challenge' })
  codeChallenge: string;

  @Index()
  @Column({ name: 'code_hash', type: 'varchar', nullable: true })
  codeHash: string | null;

  @Column({ name: 'code_expires_at', type: 'timestamptz', nullable: true })
  codeExpiresAt: Date | null;

  @Column({ name: 'code_used_at', type: 'timestamptz', nullable: true })
  codeUsedAt: Date | null;

  @Index()
  @Column({ name: 'refresh_hash', type: 'varchar', nullable: true })
  refreshHash: string | null;

  @Index()
  @Column({ name: 'previous_refresh_hash', type: 'varchar', nullable: true })
  previousRefreshHash: string | null;

  @Column({ name: 'refresh_expires_at', type: 'timestamptz', nullable: true })
  refreshExpiresAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
