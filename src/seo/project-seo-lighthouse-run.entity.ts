import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectSeoAuditRun } from './project-seo-audit-run.entity';

@Entity('project_seo_lighthouse_runs')
export class ProjectSeoLighthouseRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_id' })
  runId: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'float', nullable: true })
  lcp: number | null;

  @Column({ type: 'float', nullable: true })
  cls: number | null;

  @Column({ type: 'float', nullable: true })
  inp: number | null;

  @Column({ type: 'jsonb', default: {} })
  categories: Record<string, unknown>;

  @Column({ name: 'key_audits', type: 'jsonb', default: {} })
  keyAudits: Record<string, unknown>;

  @Column({ name: 'error_code', type: 'varchar', nullable: true })
  errorCode: string | null;

  @ManyToOne(() => ProjectSeoAuditRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run: ProjectSeoAuditRun;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
