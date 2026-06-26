import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { TaskComment } from './task-comment.entity';
import { TaskEvidence } from './task-evidence.entity';
import { TaskEvidenceController } from './task-evidence.controller';
import { TaskEvidenceService } from './task-evidence.service';
import { TaskHistoryEntry } from './task-history-entry.entity';
import { Task } from './task.entity';
import { TaskActivityService } from './task-activity.service';
import { TasksController } from './tasks.controller';
import { TasksGlobalController } from './tasks-global.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskComment,
      TaskHistoryEntry,
      TaskEvidence,
    ]),
    OrganizationsModule,
    ProjectsModule,
    UserActivityModule,
  ],
  controllers: [
    TasksController,
    TasksGlobalController,
    TaskEvidenceController,
  ],
  providers: [TasksService, TaskActivityService, TaskEvidenceService],
  exports: [TasksService, TaskActivityService, TaskEvidenceService],
})
export class TasksModule {}
