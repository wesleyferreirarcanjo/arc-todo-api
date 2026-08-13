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
import { ProjectWireframe } from '../wireframes/project-wireframe.entity';

@Entity('project_diagrams')
export class ProjectDiagram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'wireframe_id', type: 'uuid', nullable: true })
  wireframeId: string | null;

  @Column()
  title: string;

  @Column({ name: 'scene_json', type: 'jsonb', default: {} })
  sceneJson: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  thumbnail: string | null;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => ProjectWireframe, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'wireframe_id' })
  wireframe: ProjectWireframe | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
