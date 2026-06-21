import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { TaskComment } from './task-comment.entity';
import { TaskHistoryEntry } from './task-history-entry.entity';
import { Task } from './task.entity';
import { TaskActivityService } from './task-activity.service';
import { TasksController } from './tasks.controller';
import { TasksGlobalController } from './tasks-global.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskComment, TaskHistoryEntry]),
    OrganizationsModule,
    ProjectsModule,
  ],
  controllers: [TasksController, TasksGlobalController],
  providers: [TasksService, TaskActivityService],
  exports: [TasksService, TaskActivityService],
})
export class TasksModule {}
