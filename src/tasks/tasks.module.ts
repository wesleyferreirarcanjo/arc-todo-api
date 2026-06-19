import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksGlobalController } from './tasks-global.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    OrganizationsModule,
    ProjectsModule,
  ],
  controllers: [TasksController, TasksGlobalController],
  providers: [TasksService],
})
export class TasksModule {}
