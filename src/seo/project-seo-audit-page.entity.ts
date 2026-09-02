import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectSeoAuditRun } from './project-seo-audit-run.entity';

@Entity('project_seo_audit_pages')
export class ProjectSeoAuditPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_id' })
  runId: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ name: 'redirect_to', type: 'text', nullable: true })
  redirectTo: string | null;

  @Column({ type: 'text', default: '' })
  title: string;

  @Column({ name: 'meta_description', type: 'text', default: '' })
  metaDescription: string;

  @Column({ name: 'og_ok', type: 'boolean', default: false })
  ogOk: boolean;

  @Column({ name: 'jsonld_ok', type: 'boolean', default: false })
  jsonldOk: boolean;

  @Column({ name: 'robots_allowed', type: 'boolean', default: true })
  robotsAllowed: boolean;

  @Column({ name: 'in_sitemap', type: 'boolean', default: false })
  inSitemap: boolean;

  @Column({ name: 'broken_link', type: 'boolean', default: false })
  brokenLink: boolean;

  @ManyToOne(() => ProjectSeoAuditRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run: ProjectSeoAuditRun;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
