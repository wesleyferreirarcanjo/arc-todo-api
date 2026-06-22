import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { Task } from '../tasks/task.entity';
import { TasksModule } from '../tasks/tasks.module';
import { BoardCycleHistoryEntry } from './board-cycle-history-entry.entity';
import { BoardCycle } from './board-cycle.entity';
import { BoardCyclesController } from './board-cycles.controller';
import { BoardCyclesService } from './board-cycles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BoardCycle, BoardCycleHistoryEntry, Task]),
    ProjectsModule,
    TasksModule,
  ],
  controllers: [BoardCyclesController],
  providers: [BoardCyclesService],
})
export class BoardCyclesModule {}
