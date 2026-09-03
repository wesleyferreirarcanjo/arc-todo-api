import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ProjectNameSession } from './project-name-session.entity';

@Entity('name_candidate_feedback')
@Unique('UQ_name_feedback_round_candidate_user', [
  'roundId',
  'candidateId',
  'userId',
])
@Index('IDX_name_feedback_session_id', ['sessionId'])
export class NameCandidateFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'round_id', type: 'uuid' })
  roundId: string;

  @Column({ name: 'candidate_id', type: 'uuid' })
  candidateId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'first_impression', type: 'text', default: '' })
  firstImpression: string;

  @Column({ name: 'remembered_spelling', type: 'text', default: '' })
  rememberedSpelling: string;

  @Column({ name: 'perceived_purpose', type: 'text', default: '' })
  perceivedPurpose: string;

  @Column({ type: 'jsonb', default: {} })
  ratings: Record<string, unknown>;

  @Column({ type: 'text', default: '' })
  concern: string;

  @Column({ type: 'varchar', nullable: true })
  reaction: string | null;

  @ManyToOne(() => ProjectNameSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: ProjectNameSession;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
