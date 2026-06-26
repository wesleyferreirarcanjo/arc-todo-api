import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PersonsModule } from '../persons/persons.module';
import { ProjectsModule } from '../projects/projects.module';
import { RagSettingsModule } from '../rag-settings/rag-settings.module';
import { StorageModule } from '../storage/storage.module';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { KnowledgeAttachment } from './knowledge-attachment.entity';
import { KnowledgeAttachmentService } from './knowledge-attachment.service';
import {
  GeneralPersonKnowledgeAttachmentsController,
  GlobalKnowledgeAttachmentsController,
  OrganizationKnowledgeAttachmentsController,
  PersonKnowledgeAttachmentsController,
  ProjectKnowledgeAttachmentsController,
} from './knowledge-attachments.controller';
import { KnowledgeEntry } from './knowledge-entry.entity';
import { GeneralPersonKnowledgeController } from './knowledge-general-person.controller';
import { KnowledgeGlobalController } from './knowledge-global.controller';
import { OrganizationKnowledgeController } from './knowledge-organization.controller';
import { PersonKnowledgeController } from './knowledge-person.controller';
import { ProjectKnowledgeController } from './knowledge-project.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeEntry, KnowledgeAttachment]),
    StorageModule,
    OrganizationsModule,
    ProjectsModule,
    PersonsModule,
    RagSettingsModule,
    UserActivityModule,
  ],
  controllers: [
    KnowledgeGlobalController,
    GeneralPersonKnowledgeController,
    OrganizationKnowledgeController,
    ProjectKnowledgeController,
    PersonKnowledgeController,
    GlobalKnowledgeAttachmentsController,
    GeneralPersonKnowledgeAttachmentsController,
    OrganizationKnowledgeAttachmentsController,
    ProjectKnowledgeAttachmentsController,
    PersonKnowledgeAttachmentsController,
  ],
  providers: [KnowledgeService, KnowledgeAttachmentService],
})
export class KnowledgeModule {}
