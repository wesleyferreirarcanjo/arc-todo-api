import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleSsoDto } from './dto/google-sso.dto';
import { LoginDto } from './dto/login.dto';

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
}
