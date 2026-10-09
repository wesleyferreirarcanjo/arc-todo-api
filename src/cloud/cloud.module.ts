import { Module } from '@nestjs/common';
import { ProjectAccessModule } from '../projects/project-access.module';
import { CloudController } from './cloud.controller';
import { CloudService } from './cloud.service';

@Module({
  imports: [ProjectAccessModule],
  controllers: [CloudController],
  providers: [CloudService],
})
export class CloudModule {}
