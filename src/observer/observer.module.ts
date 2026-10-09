import { Module } from '@nestjs/common';
import { ProjectAccessModule } from '../projects/project-access.module';
import { ObserverController } from './observer.controller';
import { ObserverService } from './observer.service';

@Module({
  imports: [ProjectAccessModule],
  controllers: [ObserverController],
  providers: [ObserverService],
})
export class ObserverModule {}
