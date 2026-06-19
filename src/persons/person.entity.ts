import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';

@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string | null;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
