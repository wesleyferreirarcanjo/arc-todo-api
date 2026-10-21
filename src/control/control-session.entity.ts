import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One active caller on one machine at a time (partial unique index in the migration). */
@Entity('control_sessions')
export class ControlSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'machine_id', type: 'uuid' })
  machineId: string;

  @Index()
  @Column({ name: 'caller_user_id', type: 'uuid' })
  callerUserId: string;

  @Column({ name: 'last_activity_at', type: 'timestamptz' })
  lastActivityAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  /** release | idle | revoke | pause */
  @Column({ name: 'close_reason', type: 'varchar', nullable: true })
  closeReason: string | null;

  @CreateDateColumn({ name: 'opened_at' })
  openedAt: Date;
}
