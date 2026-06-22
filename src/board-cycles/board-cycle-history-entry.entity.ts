import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskStatus } from '../tasks/task.enums';
import { BoardCycle } from './board-cycle.entity';
import { COMPLETION_TIMESTAMP_SOURCE_TASK_UPDATED_AT } from './board-cycle.enums';

@Entity('board_cycle_history_entries')
export class BoardCycleHistoryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cycle_id', type: 'uuid' })
  cycleId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @Column({ name: 'parent_task_id', type: 'uuid', nullable: true })
  parentTaskId: string | null;

  @Column({ name: 'display_id', type: 'varchar' })
  displayId: string;

  @Column({ name: 'task_number', type: 'int' })
  taskNumber: number;

  @Column()
  title: string;

  @Column({
    type: 'enum',
    enum: TaskStatus,
  })
  status: TaskStatus;

  @Column({ name: 'completed_at', type: 'timestamptz' })
  completedAt: Date;

  @Column({
    name: 'completion_timestamp_source',
    type: 'varchar',
    default: COMPLETION_TIMESTAMP_SOURCE_TASK_UPDATED_AT,
  })
  completionTimestampSource: string;

  @Column({ name: 'archived_at', type: 'timestamptz' })
  archivedAt: Date;

  @ManyToOne(() => BoardCycle, (cycle) => cycle.historyEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cycle_id' })
  cycle: BoardCycle;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
