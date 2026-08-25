import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectQaProfile } from './project-qa-profile.entity';
import { QaInfoController } from './qa-info.controller';
import { QaInfoService } from './qa-info.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectQaProfile]), ProjectsModule],
  controllers: [QaInfoController],
  providers: [QaInfoService],
  exports: [QaInfoService],
})
export class QaInfoModule {}
