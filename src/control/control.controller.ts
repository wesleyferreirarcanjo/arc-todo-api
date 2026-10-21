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
import { ControlService } from './control.service';
import { MachineRenameDto } from './dto/machine-rename.dto';
import { UsageUploadDto } from './dto/usage-upload.dto';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ControlController {
  constructor(private readonly control: ControlService) {}

  @Get('machines')
  listMachines(@Req() req: AuthRequest) {
    return this.control.listMachines(req.user.id);
  }

  @Patch('machines/:id')
  renameMachine(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: MachineRenameDto,
  ) {
    return this.control.renameMachine(id, req.user.id, dto);
  }

  @Post('machines/:id/revoke')
  revokeMachine(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.control.revokeMachine(id, req.user.id);
  }

  @Get('machines/:id/sessions')
  listSessions(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.control.listSessions(id, req.user.id);
  }

  @Get('machines/:id/tool-calls')
  listToolCalls(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.control.listToolCalls(id, req.user.id);
  }

  @Get('machines/:id/usage')
  listUsage(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.control.listUsage(id, req.user.id);
  }

  /** Arc IDE reports one row per turn; the same turn is ignored on retry. */
  @Post('usage')
  reportUsage(@Req() req: AuthRequest, @Body() dto: UsageUploadDto) {
    return this.control.reportUsage(req.user.id, dto);
  }
}
