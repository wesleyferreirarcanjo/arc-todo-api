import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ControlService } from './control.service';
import { MachineConnectAuthorizeDto } from './dto/machine-connect-authorize.dto';
import { MachineConnectTokenDto } from './dto/machine-connect-token.dto';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

/**
 * "Connect this machine" PKCE — mirrors `/auth/desktop/*` but issues a
 * one-time machine credential instead of a user JWT, so the desktop flow
 * stays untouched.
 */
@Controller('auth/machine')
export class MachineConnectController {
  constructor(private readonly control: ControlService) {}

  @Post('authorize')
  @UseGuards(JwtAuthGuard)
  authorize(@Req() req: AuthRequest, @Body() dto: MachineConnectAuthorizeDto) {
    return this.control.authorizeMachineConnect(req.user.id, dto);
  }

  @Post('token')
  token(@Body() dto: MachineConnectTokenDto) {
    return this.control.exchangeMachineConnectCode(dto);
  }
}
