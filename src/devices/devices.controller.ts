import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { UpdateDeviceDto } from './dto/update-device.dto';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  listDevices(@Req() req: AuthRequest) {
    return this.devices.listDevices(req.user.id);
  }

  @Get(':id')
  getDevice(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.devices.getDevice(id, req.user.id);
  }

  @Patch(':id')
  updateDevice(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devices.updateDevice(id, req.user.id, dto);
  }

  @Post(':id/revoke')
  revokeDevice(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.devices.revokeDevice(id, req.user.id);
  }

  @Get(':id/sessions')
  listSessions(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.devices.listSessions(id, req.user.id);
  }

  @Get(':id/audit')
  listAudit(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.devices.listAudit(id, req.user.id);
  }
}
