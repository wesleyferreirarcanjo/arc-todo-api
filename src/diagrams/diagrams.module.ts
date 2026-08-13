import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectWireframe } from '../wireframes/project-wireframe.entity';
import { DiagramsController } from './diagrams.controller';
import { DiagramsService } from './diagrams.service';
import { ProjectDiagram } from './project-diagram.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectDiagram, ProjectWireframe]),
    ProjectsModule,
  ],
  controllers: [DiagramsController],
  providers: [DiagramsService],
  exports: [DiagramsService],
})
export class DiagramsModule {}
