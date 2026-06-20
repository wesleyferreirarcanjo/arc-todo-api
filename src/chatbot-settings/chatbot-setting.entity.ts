import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('chatbot_settings')
export class ChatbotSetting {
  @PrimaryColumn({ default: 'default' })
  id: string;

  @Column({ default: 'deepseek' })
  provider: string;

  @Column({ name: 'base_url', default: 'https://api.deepseek.com' })
  baseUrl: string;

  @Column({ default: 'deepseek-chat' })
  model: string;

  @Column({ name: 'api_key', type: 'text', nullable: true })
  apiKey: string | null;

  @Column({ type: 'float', default: 0.2 })
  temperature: number;

  @Column({ default: false })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
