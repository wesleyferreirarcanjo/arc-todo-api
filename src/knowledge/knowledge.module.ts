import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAccessModule } from '../projects/project-access.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PersonsModule } from '../persons/persons.module';
import { ProjectsModule } from '../projects/projects.module';
import { RagSettingsModule } from '../rag-settings/rag-settings.module';
import { StorageModule } from '../storage/storage.module';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { Organization } from '../organizations/organization.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import { KnowledgeAccessGrant } from './knowledge-access-grant.entity';
import { KnowledgeAccessService } from './knowledge-access.service';
import {
  OrganizationKnowledgeAccessController,
  OrganizationKnowledgeGrantsController,
  ProjectKnowledgeAccessController,
  ProjectKnowledgeGrantsController,
} from './knowledge-access.controller';
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
    TypeOrmModule.forFeature([
      KnowledgeEntry,
      KnowledgeAttachment,
      KnowledgeAccessGrant,
      User,
      Organization,
      Project,
      ProjectMember,
    ]),
    StorageModule,
    OrganizationsModule,
    ProjectAccessModule,
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
    OrganizationKnowledgeAccessController,
    OrganizationKnowledgeGrantsController,
    ProjectKnowledgeAccessController,
    ProjectKnowledgeGrantsController,
    GlobalKnowledgeAttachmentsController,
    GeneralPersonKnowledgeAttachmentsController,
    OrganizationKnowledgeAttachmentsController,
    ProjectKnowledgeAttachmentsController,
    PersonKnowledgeAttachmentsController,
  ],
  providers: [
    KnowledgeService,
    KnowledgeAttachmentService,
    KnowledgeAccessService,
  ],
  exports: [KnowledgeAccessService],
})
export class KnowledgeModule {}
