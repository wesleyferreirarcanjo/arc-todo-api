import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { KnowledgeEntry } from './knowledge-entry.entity';

@Entity('knowledge_attachments')
export class KnowledgeAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'knowledge_entry_id' })
  knowledgeEntryId: string;

  @Column()
  bucket: string;

  @Column({ name: 'object_key' })
  objectKey: string;

  @Column({ name: 'original_filename' })
  originalFilename: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ name: 'uploaded_by_id' })
  uploadedById: string;

  @ManyToOne(() => KnowledgeEntry, (entry) => entry.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'knowledge_entry_id' })
  knowledgeEntry: KnowledgeEntry;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
