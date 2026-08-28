import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { Task } from '../tasks/task.entity';
import { QaQueueItem } from './qa-queue-item.entity';
import { QaQueueEventsService } from './qa-queue-events.service';
import { QaQueueController } from './qa-queue.controller';
import { QaQueueService } from './qa-queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([QaQueueItem, Task]),
    ProjectsModule,
  ],
  controllers: [QaQueueController],
  providers: [QaQueueService, QaQueueEventsService],
  exports: [QaQueueService, QaQueueEventsService],
})
export class QaQueueModule {}
