import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAccessModule } from './project-access.module';
import { Project } from './project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), ProjectAccessModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService, ProjectAccessModule],
})
export class ProjectsModule {}
