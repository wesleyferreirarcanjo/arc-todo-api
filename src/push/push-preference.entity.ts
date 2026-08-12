import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('push_preferences')
export class PushPreference {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'notify_comment', default: true })
  notifyComment: boolean;

  @Column({ name: 'notify_status_gate', default: true })
  notifyStatusGate: boolean;

  @Column({ name: 'notify_due_today', default: true })
  notifyDueToday: boolean;

  @Column({ name: 'opted_in_at', type: 'timestamptz', nullable: true })
  optedInAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
