import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesModule } from '../devices/devices.module';
import { UsersModule } from '../users/users.module';
import { ControlInternalController } from './control-internal.controller';
import { ControlInternalGuard } from './control-internal.guard';
import { ControlSession } from './control-session.entity';
import { ControlToolCall } from './control-tool-call.entity';
import { ControlController } from './control.controller';
import { ControlService } from './control.service';
import { MachineConnectController } from './machine-connect.controller';
import { MachineConnectSession } from './machine-connect-session.entity';
import { Machine } from './machine.entity';
import { TokenUsage } from './token-usage.entity';

@Module({
  imports: [
    UsersModule,
    DevicesModule,
    TypeOrmModule.forFeature([
      Machine,
      MachineConnectSession,
      ControlSession,
      ControlToolCall,
      TokenUsage,
    ]),
  ],
  controllers: [
    ControlController,
    ControlInternalController,
    MachineConnectController,
  ],
  providers: [ControlService, ControlInternalGuard],
})
export class ControlModule {}
