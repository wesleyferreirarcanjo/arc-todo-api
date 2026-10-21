import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One row per Arc IDE turn (`turn_id` unique — the same turn is never recorded
 * twice). Cost is agent-reported only: `cost_delta` stays null when the agent
 * did not report it and the UI shows "not reported".
 */
@Entity('token_usage')
export class TokenUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'turn_id' })
  turnId: string;

  @Index()
  @Column({ name: 'arc_todo_user_id', type: 'uuid' })
  arcTodoUserId: string;

  @Column({ name: 'control_session_id', type: 'uuid', nullable: true })
  controlSessionId: string | null;

  @Index()
  @Column({ name: 'machine_id', type: 'uuid', nullable: true })
  machineId: string | null;

  @Column({ name: 'estimated_input_tokens', type: 'int', nullable: true })
  estimatedInputTokens: number | null;

  @Column({ name: 'estimated_output_tokens', type: 'int', nullable: true })
  estimatedOutputTokens: number | null;

  @Column({ name: 'reported_input_tokens', type: 'int', nullable: true })
  reportedInputTokens: number | null;

  @Column({ name: 'reported_output_tokens', type: 'int', nullable: true })
  reportedOutputTokens: number | null;

  @Column({ name: 'cost_delta', type: 'numeric', nullable: true })
  costDelta: string | null;

  @Column({ name: 'cost_currency', type: 'varchar', nullable: true })
  costCurrency: string | null;

  /** e.g. 'arc-ide' or 'relay' */
  @Column({ name: 'source' })
  source: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
