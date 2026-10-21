import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ControlInternalGuard } from './control-internal.guard';
import { ControlService } from './control.service';
import { InternalMachineAuthenticateDto } from './dto/internal-machine-authenticate.dto';
import { InternalSessionCloseDto } from './dto/internal-session-close.dto';
import { InternalSessionOpenDto } from './dto/internal-session-open.dto';
import { InternalSessionTouchDto } from './dto/internal-session-touch.dto';
import { InternalToolCallDto } from './dto/internal-tool-call.dto';
import { UsageUploadDto } from './dto/usage-upload.dto';

/**
 * Service-token routes consumed by the control relay (#ard-291) and the
 * Arc IDE usage upload. Bearer `ARC_CONTROL_INTERNAL_TOKEN`, never a user JWT.
 */
@Controller('internal/control')
@UseGuards(ControlInternalGuard)
export class ControlInternalController {
  constructor(private readonly control: ControlService) {}

  @Post('machines/authenticate')
  authenticate(@Body() dto: InternalMachineAuthenticateDto) {
    return this.control.authenticateMachine(dto);
  }

  @Post('sessions/open')
  openSession(@Body() dto: InternalSessionOpenDto) {
    return this.control.openSession(dto);
  }

  @Post('sessions/touch')
  touchSession(@Body() dto: InternalSessionTouchDto) {
    return this.control.touchSession(dto);
  }

  @Post('sessions/close')
  closeSession(@Body() dto: InternalSessionCloseDto) {
    return this.control.closeSession(dto);
  }

  @Post('tool-calls')
  recordToolCall(@Body() dto: InternalToolCallDto) {
    return this.control.recordToolCall(dto);
  }

  @Post('usage')
  recordUsage(@Body() dto: UsageUploadDto) {
    return this.control.recordUsageInternal(dto);
  }
}
