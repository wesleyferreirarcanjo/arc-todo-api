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
import { User } from '../users/user.entity';
import { ConversationMessage } from './conversation-message.entity';
import { ConversationTaskContext } from './conversation-task-context.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string | null;

  @Column({ name: 'project_id', nullable: true })
  projectId: string | null;

  @Column({ default: 'New conversation' })
  title: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => ConversationMessage, (message) => message.conversation)
  messages: ConversationMessage[];

  @OneToMany(() => ConversationTaskContext, (context) => context.conversation)
  taskContexts: ConversationTaskContext[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
