import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoardCyclesService } from './board-cycles.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/board')
@UseGuards(JwtAuthGuard)
export class BoardCyclesController {
  constructor(private readonly boardCyclesService: BoardCyclesService) {}

  @Get('cycle/current')
  getCurrentCycle(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.boardCyclesService.getCurrentCycle(
      req.user.id,
      orgId,
      projectId,
    );
  }

  @Post('cycle/advance')
  advanceCycle(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.boardCyclesService.advanceCycle(
      req.user.id,
      orgId,
      projectId,
    );
  }

  @Get('cycles/history')
  getHistory(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.boardCyclesService.getHistory(
      req.user.id,
      orgId,
      projectId,
    );
  }
}
