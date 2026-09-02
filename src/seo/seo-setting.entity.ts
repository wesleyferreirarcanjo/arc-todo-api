import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('seo_settings')
export class SeoSetting {
  @PrimaryColumn({ default: 'default' })
  id: string;

  @Column({ name: 'max_pages_per_audit', type: 'int', default: 200 })
  maxPagesPerAudit: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
