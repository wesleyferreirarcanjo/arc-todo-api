import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../projects/admin.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary-query.dto';
import { CreateBugFlagDossierDto } from './dto/create-bug-flag-dossier.dto';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(@Query() query: AnalyticsSummaryQueryDto) {
    return this.analyticsService.getSummary(query);
  }

  @Get('bug-flags')
  listBugFlags(@Query() query: AnalyticsSummaryQueryDto) {
    return this.analyticsService.listBugFlags(query);
  }

  @Get('bug-flags/task/:taskId')
  getLatestBugFlag(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.analyticsService.getLatestBugFlag(taskId);
  }

  @Post('bug-flags')
  createBugFlag(@Body() dto: CreateBugFlagDossierDto, @Req() req: AuthRequest) {
    return this.analyticsService.createBugFlag(req.user.id, dto);
  }
}
