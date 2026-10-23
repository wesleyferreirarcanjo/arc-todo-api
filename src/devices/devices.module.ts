import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControlSession } from '../control/control-session.entity';
import { ControlToolCall } from '../control/control-tool-call.entity';
import { Machine } from '../control/machine.entity';
import { UsersModule } from '../users/users.module';
import { DevicesInternalController } from './devices-internal.controller';
import { DevicesInternalGuard } from './devices-internal.guard';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Machine, ControlSession, ControlToolCall]),
  ],
  controllers: [DevicesController, DevicesInternalController],
  providers: [DevicesService, DevicesInternalGuard],
  exports: [DevicesService],
})
export class DevicesModule {}
