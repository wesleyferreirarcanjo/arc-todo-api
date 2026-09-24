import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../projects/admin.guard';
import { DeviceControlService } from './device-control.service';
import { EnqueueDeviceCommandDto } from './dto/enqueue-device-command.dto';

interface AuthRequest {
  user: { id: string; username: string };
}

@Controller('device-control')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DeviceControlController {
  constructor(private readonly deviceControl: DeviceControlService) {}

  @Get('devices')
  listDevices() {
    return this.deviceControl.listDevices();
  }

  @Get('devices/:id/audit')
  audit(@Param('id') id: string) {
    return this.deviceControl.audit(id);
  }

  @Post('devices/:id/commands')
  enqueue(@Param('id') id: string, @Body() dto: EnqueueDeviceCommandDto, @Req() req: AuthRequest) {
    return this.deviceControl.enqueue(id, dto.action, dto.payload, dto.idempotencyKey, req.user.username);
  }

  @Post('devices/:id/revoke')
  revoke(@Param('id') id: string) {
    return this.deviceControl.revoke(id);
  }
}
