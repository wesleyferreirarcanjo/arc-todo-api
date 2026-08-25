import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProjectQaInfoDto } from './dto/update-project-qa-info.dto';
import { QaInfoService } from './qa-info.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/qa-info')
@UseGuards(JwtAuthGuard)
export class QaInfoController {
  constructor(private readonly qaInfoService: QaInfoService) {}

  @Get()
  get(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.qaInfoService.get(req.user.id, orgId, projectId);
  }

  @Put()
  upsert(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectQaInfoDto,
    @Req() req: AuthRequest,
  ) {
    return this.qaInfoService.upsert(req.user.id, orgId, projectId, dto);
  }
}
