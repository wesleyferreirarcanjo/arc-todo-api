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
import { VideoFileKind } from './video-files';

export interface ProjectVideoFileEntry {
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  /** Object-store bucket. Missing means the MinIO bucket. */
  bucket?: string;
}

export type ProjectVideoFiles = Partial<
  Record<VideoFileKind, ProjectVideoFileEntry>
>;

@Entity('project_videos')
export class ProjectVideo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column()
  title: string;

  @Column({ name: 'edit_state', type: 'jsonb', nullable: true })
  editState: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: {} })
  files: ProjectVideoFiles;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

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
