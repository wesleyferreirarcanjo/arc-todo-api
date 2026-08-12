import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../tasks/task.entity';
import { PushController } from './push.controller';
import { PushDueTodaySchedulerService } from './push-due-today.scheduler';
import { PushPreference } from './push-preference.entity';
import { PushService } from './push.service';
import { PushSubscription } from './push-subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscription, PushPreference, Task]),
  ],
  controllers: [PushController],
  providers: [PushService, PushDueTodaySchedulerService],
  exports: [PushService],
})
export class PushModule {}
