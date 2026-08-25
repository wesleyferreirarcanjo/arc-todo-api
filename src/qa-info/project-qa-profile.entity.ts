import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import type { QaEnvironment, QaUser } from './qa-info.util';

@Entity('project_qa_profiles')
@Unique(['projectId'])
export class ProjectQaProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  environments: QaEnvironment[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  users: QaUser[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'updated_by_id', type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
