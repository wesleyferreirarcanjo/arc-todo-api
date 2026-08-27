import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Project } from '../projects/project.entity';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';

@Entity('qa_queue_items')
@Unique('UQ_qa_queue_items_user_task', ['userId', 'taskId'])
@Unique('UQ_qa_queue_items_user_project_position', [
  'userId',
  'projectId',
  'position',
])
@Index('IDX_qa_queue_items_user_id', ['userId'])
export class QaQueueItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'int' })
  position: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
