import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

@Entity('project_name_sessions')
export class ProjectNameSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  brief: string;

  @Column({ name: 'naming_goal', type: 'varchar', nullable: true })
  namingGoal: string | null;

  @Column({ name: 'product_description', type: 'jsonb', default: {} })
  productDescription: Record<string, unknown>;

  @Column({ type: 'jsonb', default: [] })
  lanes: unknown[];

  @Column({ type: 'jsonb', default: [] })
  candidates: unknown[];

  @Column({ name: 'shortlist_ids', type: 'jsonb', default: [] })
  shortlistIds: string[];

  @Column({ name: 'recommended_candidate_id', type: 'uuid', nullable: true })
  recommendedCandidateId: string | null;

  @Column({ name: 'runner_up_candidate_id', type: 'uuid', nullable: true })
  runnerUpCandidateId: string | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @Column({ name: 'feedback_rounds', type: 'jsonb', default: [] })
  feedbackRounds: unknown[];

  @Column({ type: 'jsonb', default: [] })
  batches: unknown[];

  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
