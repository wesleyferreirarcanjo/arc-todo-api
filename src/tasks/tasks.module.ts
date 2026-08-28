import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { PushModule } from '../push/push.module';
import { QaQueueModule } from '../qa-queue/qa-queue.module';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { TaskComment } from './task-comment.entity';
import { TaskEvidence } from './task-evidence.entity';
import { TaskEvidenceController } from './task-evidence.controller';
import { TaskEvidenceService } from './task-evidence.service';
import { TaskLog } from './task-log.entity';
import { TaskLogController } from './task-log.controller';
import { TaskLogService } from './task-log.service';
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
      TaskLog,
    ]),
    OrganizationsModule,
    ProjectsModule,
    UserActivityModule,
    forwardRef(() => PushModule),
    QaQueueModule,
  ],
  controllers: [
    TasksController,
    TasksGlobalController,
    TaskEvidenceController,
    TaskLogController,
    StorageController,
  ],
  providers: [
    TasksService,
    TaskActivityService,
    TaskEvidenceService,
    TaskLogService,
    EvidenceRetentionSchedulerService,
  ],
  exports: [
    TasksService,
    TaskActivityService,
    TaskEvidenceService,
    TaskLogService,
  ],
})
export class TasksModule {}
