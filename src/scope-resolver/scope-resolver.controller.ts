import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResolveScopeQueryDto } from './dto/resolve-scope-query.dto';
import { ScopeResolverService } from './scope-resolver.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('scope')
@UseGuards(JwtAuthGuard)
export class ScopeResolverController {
  constructor(private readonly scopeResolverService: ScopeResolverService) {}

  @Get('resolve')
  resolve(@Query() query: ResolveScopeQueryDto, @Req() req: AuthRequest) {
    return this.scopeResolverService.resolveForUser(req.user.id, query);
  }
}
