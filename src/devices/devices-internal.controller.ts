import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DevicesInternalGuard } from './devices-internal.guard';
import { DevicesService } from './devices.service';
import {
  InternalDeviceAuditDto,
  InternalDeviceSessionCloseDto,
  InternalDeviceSessionOpenDto,
  InternalDeviceSessionTouchDto,
  InternalHeartbeatDeviceDto,
  InternalRegisterDeviceDto,
  InternalRevokeDeviceDto,
} from './dto/internal-devices.dto';

/**
 * Relay write surface for the shared device model. Bearer service token
 * (ARC_CONTROL_INTERNAL_TOKEN and/or ARC_BROWSER_INTERNAL_TOKEN /
 * ARC_HUB_INTERNAL_TOKEN). The Windows relay stays on `/internal/control/*`
 * (#arc-639); browser and Hub point here in their own cards.
 */
@Controller('internal/devices')
@UseGuards(DevicesInternalGuard)
export class DevicesInternalController {
  constructor(private readonly devices: DevicesService) {}

  @Post('register')
  register(@Body() dto: InternalRegisterDeviceDto) {
    return this.devices.register(dto);
  }

  @Post('heartbeat')
  heartbeat(@Body() dto: InternalHeartbeatDeviceDto) {
    return this.devices.heartbeat(dto);
  }

  @Post('sessions/open')
  openSession(@Body() dto: InternalDeviceSessionOpenDto) {
    return this.devices.openSession(dto);
  }

  @Post('sessions/touch')
  touchSession(@Body() dto: InternalDeviceSessionTouchDto) {
    return this.devices.touchSession(dto);
  }

  @Post('sessions/close')
  closeSession(@Body() dto: InternalDeviceSessionCloseDto) {
    return this.devices.closeSession(dto);
  }

  @Post('audit')
  appendAudit(@Body() dto: InternalDeviceAuditDto) {
    return this.devices.appendAudit(dto);
  }

  @Post('revoke')
  revoke(@Body() dto: InternalRevokeDeviceDto) {
    return this.devices.revokeInternal(dto);
  }
}
