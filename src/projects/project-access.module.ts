import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { AdminGuard } from './admin.guard';
import { ProjectAccessService } from './project-access.service';
import { ProjectMember } from './project-member.entity';
import { Project } from './project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ProjectMember, Project, Organization]),
  ],
  providers: [ProjectAccessService, AdminGuard],
  exports: [ProjectAccessService, AdminGuard],
})
export class ProjectAccessModule {}
