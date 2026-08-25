import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../projects/admin.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(@Query() query: AnalyticsSummaryQueryDto) {
    return this.analyticsService.getSummary(query);
  }
}
