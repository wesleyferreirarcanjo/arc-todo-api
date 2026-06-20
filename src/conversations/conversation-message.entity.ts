import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { ConversationMessageRole } from './conversation-message-role.enum';

@Entity('conversation_messages')
export class ConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({
    type: 'enum',
    enum: ConversationMessageRole,
  })
  role: ConversationMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'used_tools', type: 'text', array: true, default: '{}' })
  usedTools: string[];

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
