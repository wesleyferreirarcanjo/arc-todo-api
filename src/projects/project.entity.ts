import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Task } from '../tasks/task.entity';
import { ProjectMember } from './project-member.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 7, default: '#737373' })
  color: string;

  @Column({ type: 'varchar', length: 3, unique: true })
  acronym: string;

  @Column({ name: 'next_task_number', type: 'int', default: 1 })
  nextTaskNumber: number;

  @ManyToOne(() => Organization, (organization) => organization.projects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @OneToMany(() => ProjectMember, (member) => member.project)
  members: ProjectMember[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
