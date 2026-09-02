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

@Entity('project_seo_sites')
@Unique('UQ_project_seo_sites_project_hostname', ['projectId', 'hostname'])
export class ProjectSeoSite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column()
  hostname: string;

  @Column({ default: '' })
  title: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({
    name: 'gsc_refresh_token',
    type: 'text',
    nullable: true,
    select: false,
  })
  gscRefreshToken: string | null;

  @Column({ name: 'gsc_property_uri', type: 'text', nullable: true })
  gscPropertyUri: string | null;

  @Column({ type: 'jsonb', default: [] })
  offerings: string[];

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
