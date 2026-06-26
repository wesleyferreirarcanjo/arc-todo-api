import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationMember } from '../organizations/organization-member.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { Task } from '../tasks/task.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'is_admin', default: false })
  isAdmin: boolean;

  @OneToMany(() => OrganizationMember, (member) => member.user)
  organizationMemberships: OrganizationMember[];

  @OneToMany(() => ProjectMember, (member) => member.user)
  projectMemberships: ProjectMember[];

  @OneToMany(() => Task, (task) => task.createdBy)
  createdTasks: Task[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
