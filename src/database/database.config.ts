import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { BoardCycle } from '../board-cycles/board-cycle.entity';
import { BoardCycleHistoryEntry } from '../board-cycles/board-cycle-history-entry.entity';
import { Conversation } from '../conversations/conversation.entity';
import { ConversationMessage } from '../conversations/conversation-message.entity';
import { ConversationTaskContext } from '../conversations/conversation-task-context.entity';
import { ChatbotSetting } from '../chatbot-settings/chatbot-setting.entity';
import { RagSetting } from '../rag-settings/rag-setting.entity';
import { KnowledgeEntry } from '../knowledge/knowledge-entry.entity';
import { KnowledgeAttachment } from '../knowledge/knowledge-attachment.entity';
import { McpToolSetting } from '../mcp-tools/mcp-tool-setting.entity';
import { OrganizationMember } from '../organizations/organization-member.entity';
import { Organization } from '../organizations/organization.entity';
import { Person } from '../persons/person.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { Project } from '../projects/project.entity';
import { TaskComment } from '../tasks/task-comment.entity';
import { TaskEvidence } from '../tasks/task-evidence.entity';
import { TaskHistoryEntry } from '../tasks/task-history-entry.entity';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { UserActivity } from '../user-activity/user-activity.entity';

export const entities = [
  User,
  Organization,
  OrganizationMember,
  Project,
  ProjectMember,
  Task,
  TaskComment,
  TaskEvidence,
  TaskHistoryEntry,
  BoardCycle,
  BoardCycleHistoryEntry,
  Person,
  KnowledgeEntry,
  KnowledgeAttachment,
  McpToolSetting,
  ChatbotSetting,
  RagSetting,
  Conversation,
  ConversationMessage,
  ConversationTaskContext,
  UserActivity,
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
