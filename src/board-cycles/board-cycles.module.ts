import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { ProjectsModule } from '../projects/projects.module';
import { Task } from '../tasks/task.entity';
import { TasksModule } from '../tasks/tasks.module';
import { BoardCycleHistoryEntry } from './board-cycle-history-entry.entity';
import { BoardCycle } from './board-cycle.entity';
import { BoardCycleSchedulerService } from './board-cycle-scheduler.service';
import { BoardCyclesController } from './board-cycles.controller';
import { BoardCyclesService } from './board-cycles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BoardCycle, BoardCycleHistoryEntry, Task, Project]),
    ProjectsModule,
    TasksModule,
  ],
  controllers: [BoardCyclesController],
  providers: [BoardCyclesService, BoardCycleSchedulerService],
})
export class BoardCyclesModule {}
