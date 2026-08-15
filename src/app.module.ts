import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { getDatabaseConfig } from './database/database.config';
import { AppExceptionFilter } from './errors/app-exception.filter';
import { BoardCyclesModule } from './board-cycles/board-cycles.module';
import { DiagramsModule } from './diagrams/diagrams.module';
import { WireframesModule } from './wireframes/wireframes.module';
import { NameSessionsModule } from './name-sessions/name-sessions.module';
import { HealthModule } from './health/health.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ConversationsModule } from './conversations/conversations.module';
import { ChatbotSettingsModule } from './chatbot-settings/chatbot-settings.module';
import { RagSettingsModule } from './rag-settings/rag-settings.module';
import { McpToolsModule } from './mcp-tools/mcp-tools.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PersonsModule } from './persons/persons.module';
import { ProjectsModule } from './projects/projects.module';
import { PushModule } from './push/push.module';
import { ScopeResolverModule } from './scope-resolver/scope-resolver.module';
import { StorageModule } from './storage/storage.module';
import { TasksModule } from './tasks/tasks.module';
import { UserActivityModule } from './user-activity/user-activity.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    ScopeResolverModule,
    TasksModule,
    BoardCyclesModule,
    PersonsModule,
    StorageModule,
    KnowledgeModule,
    DiagramsModule,
    WireframesModule,
    NameSessionsModule,
    McpToolsModule,
    ChatbotSettingsModule,
    RagSettingsModule,
    ConversationsModule,
    UserActivityModule,
    PushModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
})
export class AppModule {}
