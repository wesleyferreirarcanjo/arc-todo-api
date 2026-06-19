import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mcp_tool_settings')
export class McpToolSetting {
  @PrimaryColumn()
  key: string;

  @Column()
  group: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'default_enabled', default: true })
  defaultEnabled: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
