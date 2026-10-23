import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { ProjectAccessModule } from '../projects/project-access.module';
import { DeviceControlController } from './device-control.controller';
import { DeviceControlService } from './device-control.service';

@Module({
  imports: [ProjectAccessModule, DevicesModule],
  controllers: [DeviceControlController],
  providers: [DeviceControlService],
})
export class DeviceControlModule {}
