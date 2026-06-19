import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PersonsModule } from '../persons/persons.module';
import { ProjectsModule } from '../projects/projects.module';
import { KnowledgeEntry } from './knowledge-entry.entity';
import { GeneralPersonKnowledgeController } from './knowledge-general-person.controller';
import { KnowledgeGlobalController } from './knowledge-global.controller';
import { OrganizationKnowledgeController } from './knowledge-organization.controller';
import { PersonKnowledgeController } from './knowledge-person.controller';
import { ProjectKnowledgeController } from './knowledge-project.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeEntry]),
    OrganizationsModule,
    ProjectsModule,
    PersonsModule,
  ],
  controllers: [
    KnowledgeGlobalController,
    GeneralPersonKnowledgeController,
    OrganizationKnowledgeController,
    ProjectKnowledgeController,
    PersonKnowledgeController,
  ],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
