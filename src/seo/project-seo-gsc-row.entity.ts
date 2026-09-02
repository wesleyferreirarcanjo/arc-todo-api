import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectSeoSite } from './project-seo-site.entity';

export type SeoGscDimension = 'query' | 'page';

@Entity('project_seo_gsc_rows')
export class ProjectSeoGscRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @Column({ type: 'varchar' })
  dimension: SeoGscDimension;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'float', default: 0 })
  ctr: number;

  @Column({ type: 'float', default: 0 })
  position: number;

  @Column({ name: 'range_start', type: 'date' })
  rangeStart: string;

  @Column({ name: 'range_end', type: 'date' })
  rangeEnd: string;

  @Column({ name: 'fetched_at', type: 'timestamp' })
  fetchedAt: Date;

  @ManyToOne(() => ProjectSeoSite, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site: ProjectSeoSite;
}
