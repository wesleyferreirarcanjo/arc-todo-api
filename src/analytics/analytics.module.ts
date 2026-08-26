import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardCycleHistoryEntry } from '../board-cycles/board-cycle-history-entry.entity';
import { Organization } from '../organizations/organization.entity';
import { ProjectAccessModule } from '../projects/project-access.module';
import { Project } from '../projects/project.entity';
import { TaskHistoryEntry } from '../tasks/task-history-entry.entity';
import { TaskBugFlagDossier } from './task-bug-flag-dossier.entity';
import { Task } from '../tasks/task.entity';
import { UserActivity } from '../user-activity/user-activity.entity';
import { User } from '../users/user.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      Project,
      Organization,
      User,
      UserActivity,
      TaskHistoryEntry,
      BoardCycleHistoryEntry,
      TaskBugFlagDossier,
    ]),
    ProjectAccessModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
