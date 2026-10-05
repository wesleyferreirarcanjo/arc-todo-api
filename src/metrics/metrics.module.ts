import { Module } from '@nestjs/common';
import { ProjectAccessModule } from '../projects/project-access.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [ProjectAccessModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
