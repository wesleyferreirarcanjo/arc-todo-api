import { Module } from '@nestjs/common';
import { ProjectAccessModule } from '../projects/project-access.module';
import { DeviceControlController } from './device-control.controller';
import { DeviceControlService } from './device-control.service';

@Module({
  imports: [ProjectAccessModule],
  controllers: [DeviceControlController],
  providers: [DeviceControlService],
})
export class DeviceControlModule {}
