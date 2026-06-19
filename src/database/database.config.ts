import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { KnowledgeEntry } from '../knowledge/knowledge-entry.entity';
import { KnowledgeAttachment } from '../knowledge/knowledge-attachment.entity';
import { OrganizationMember } from '../organizations/organization-member.entity';
import { Organization } from '../organizations/organization.entity';
import { Person } from '../persons/person.entity';
import { Project } from '../projects/project.entity';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';

export const entities = [
  User,
  Organization,
  OrganizationMember,
  Project,
  Task,
  Person,
  KnowledgeEntry,
  KnowledgeAttachment,
];

export function getDatabaseConfig(
  configService: ConfigService,
): DataSourceOptions {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const synchronize =
    nodeEnv !== 'production' &&
    configService.get<string>('DB_SYNCHRONIZE') === 'true';
  const migrationsRun =
    configService.get<string>('DB_MIGRATE_ON_START') === 'true';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_DATABASE', 'arc_todo'),
    entities,
    synchronize,
    migrations: [__dirname + '/../migrations/*.js'],
    migrationsRun,
  };
}

export function getCliDatabaseConfig(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'arc_todo',
    entities: ['dist/**/*.entity.js'],
    migrations: ['dist/migrations/*.js'],
    synchronize: false,
  };
}
