import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One pending "Connect this machine" PKCE handshake. Separate from
 * `desktop_auth_sessions`, which issues user JWTs for Arc IDE — this table
 * issues a one-time code the PC exchanges for a machine credential.
 */
@Entity('machine_connect_sessions')
export class MachineConnectSession {
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

  @Column({ name: 'machine_name', type: 'varchar', nullable: true })
  machineName: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
