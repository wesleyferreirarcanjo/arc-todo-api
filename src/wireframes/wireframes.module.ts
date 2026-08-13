import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectWireframe } from './project-wireframe.entity';
import { WireframesController } from './wireframes.controller';
import { WireframesService } from './wireframes.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectWireframe]), ProjectsModule],
  controllers: [WireframesController],
  providers: [WireframesService],
  exports: [WireframesService],
})
export class WireframesModule {}
