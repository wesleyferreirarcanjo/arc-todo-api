import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { NameCandidateFeedback } from './name-candidate-feedback.entity';
import { NameCheckService } from './name-check.service';
import { NameHistoryService } from './name-history.service';
import { NameSessionsController } from './name-sessions.controller';
import { NameSessionsService } from './name-sessions.service';
import { ProjectNameSession } from './project-name-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectNameSession, NameCandidateFeedback]),
    ProjectsModule,
  ],
  controllers: [NameSessionsController],
  providers: [NameSessionsService, NameCheckService, NameHistoryService],
  exports: [NameSessionsService],
})
export class NameSessionsModule {}
