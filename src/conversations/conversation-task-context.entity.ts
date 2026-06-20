import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('conversation_task_contexts')
export class ConversationTaskContext {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column()
  title: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.taskContexts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
