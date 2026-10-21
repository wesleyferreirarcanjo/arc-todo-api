import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('control_tool_calls')
export class ControlToolCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Index()
  @Column({ name: 'machine_id', type: 'uuid' })
  machineId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'tool' })
  tool: string;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ name: 'success' })
  success: boolean;

  @Column({ name: 'error', type: 'varchar', nullable: true })
  error: string | null;

  /** Already redacted by the relay, sanitized again on write — never typed text or screenshots. */
  @Column({ name: 'inputs_redacted', type: 'jsonb', nullable: true })
  inputsRedacted: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
