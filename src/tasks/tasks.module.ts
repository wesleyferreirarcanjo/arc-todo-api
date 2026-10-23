import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudModule } from '../cloud/cloud.module';
import { MetricsModule } from '../metrics/metrics.module';
import { ObserverModule } from '../observer/observer.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { PushModule } from '../push/push.module';
import { QaInfoModule } from '../qa-info/qa-info.module';
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
import { BugRuntimeEvidenceService } from './bug-runtime-evidence.service';

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
    QaInfoModule,
    CloudModule,
    ObserverModule,
    MetricsModule,
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
    BugRuntimeEvidenceService,
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
