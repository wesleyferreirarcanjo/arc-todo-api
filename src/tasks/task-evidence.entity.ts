import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Task } from './task.entity';

@Entity('task_evidence')
export class TaskEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id' })
  taskId: string;

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

  @Column({ name: 'uploaded_by_id' })
  uploadedById: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
