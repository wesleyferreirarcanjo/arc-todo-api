import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import type { BugFlagPrimary, BugFlagSecondary } from './bug-flag-dossier.util';

@Entity('task_bug_flag_dossiers')
@Index('IDX_task_bug_flag_dossiers_task_created', ['taskId', 'createdAt'])
export class TaskBugFlagDossier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @Column({ name: 'primary_class', type: 'varchar', length: 32 })
  primary: BugFlagPrimary;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  secondary: BugFlagSecondary[];

  @Column({ type: 'text' })
  motivo: string;

  @Column({ type: 'text', nullable: true })
  evidence: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
