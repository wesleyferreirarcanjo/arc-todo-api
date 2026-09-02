import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectSeoSite } from './project-seo-site.entity';

export type SeoAuditRunStatus = 'queued' | 'running' | 'complete' | 'failed';

@Entity('project_seo_audit_runs')
export class ProjectSeoAuditRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column({ type: 'varchar' })
  status: SeoAuditRunStatus;

  @Column({ name: 'error_code', type: 'varchar', nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'robots_txt', type: 'text', nullable: true })
  robotsTxt: string | null;

  @Column({ name: 'sitemap_urls', type: 'jsonb', default: [] })
  sitemapUrls: string[];

  @ManyToOne(() => ProjectSeoSite, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site: ProjectSeoSite;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
