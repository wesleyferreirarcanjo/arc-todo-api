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
import { KnowledgeAttachment } from './knowledge-attachment.entity';
import { Organization } from '../organizations/organization.entity';
import { Person } from '../persons/person.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import { KnowledgeScope } from './knowledge-scope.enum';

@Entity('knowledge_entries')
export class KnowledgeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: KnowledgeScope,
  })
  scope: KnowledgeScope;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string | null;

  @Column({ name: 'project_id', nullable: true })
  projectId: string | null;

  @Column({ name: 'person_id', nullable: true })
  personId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @ManyToOne(() => Person, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'person_id' })
  person: Person | null;

  @OneToMany(() => KnowledgeAttachment, (attachment) => attachment.knowledgeEntry)
  attachments: KnowledgeAttachment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
