import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { PushModule } from '../push/push.module';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { TaskComment } from './task-comment.entity';
import { TaskEvidence } from './task-evidence.entity';
import { TaskEvidenceController } from './task-evidence.controller';
import { TaskEvidenceService } from './task-evidence.service';
import { EvidenceRetentionSchedulerService } from './evidence-retention-scheduler.service';
import { TaskHistoryEntry } from './task-history-entry.entity';
import { Task } from './task.entity';
import { TaskActivityService } from './task-activity.service';
import { StorageController } from './storage.controller';
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
    forwardRef(() => PushModule),
  ],
  controllers: [
    TasksController,
    TasksGlobalController,
    TaskEvidenceController,
    StorageController,
  ],
  providers: [
    TasksService,
    TaskActivityService,
    TaskEvidenceService,
    EvidenceRetentionSchedulerService,
  ],
  exports: [TasksService, TaskActivityService, TaskEvidenceService],
})
export class TasksModule {}
