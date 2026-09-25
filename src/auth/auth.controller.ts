import { Body, Controller, Delete, Get, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { DesktopAuthorizeDto } from './dto/desktop-authorize.dto';
import { DesktopRefreshDto } from './dto/desktop-refresh.dto';
import { DesktopTokenDto } from './dto/desktop-token.dto';
import { GoogleSsoDto } from './dto/google-sso.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('sso/google')
  loginWithGoogle(@Body() dto: GoogleSsoDto) {
    return this.authService.loginWithGoogle(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthRequest) {
    return this.authService.me(req.user.id);
  }

  @Post('desktop/authorize')
  @UseGuards(JwtAuthGuard)
  authorizeDesktop(@Req() req: AuthRequest, @Body() dto: DesktopAuthorizeDto) {
    return this.authService.authorizeDesktop(req.user.id, dto);
  }

  @Post('desktop/token')
  exchangeDesktopCode(@Body() dto: DesktopTokenDto) {
    return this.authService.exchangeDesktopCode(dto);
  }

  @Post('desktop/refresh')
  refreshDesktop(@Body() dto: DesktopRefreshDto) {
    return this.authService.refreshDesktop(dto);
  }

  @Delete('desktop/session')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  revokeDesktop(
    @Req() req: AuthRequest,
    @Body() dto: DesktopRefreshDto,
    @Headers('x-arc-refresh') refreshHeader?: string,
  ) {
    const refreshToken = refreshHeader || dto?.refreshToken || '';
    return this.authService.revokeDesktop(req.user.id, { refreshToken });
  }
}
