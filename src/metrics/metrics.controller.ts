import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { appError } from '../errors/app-errors';
import { AdminGuard } from '../projects/admin.guard';
import { AppSeriesQueryDto } from './dto/app-series.dto';
import { CreateAgentTokenDto } from './dto/create-agent-token.dto';
import { CreateAppTokenDto } from './dto/create-app-token.dto';
import { MetricsWindowDto } from './dto/metrics-window.dto';
import { MetricsService } from './metrics.service';

@Controller('metrics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('servers')
  listServers() {
    return this.metrics.listServers();
  }

  @Get('servers/:serverId/resources')
  getServerResources(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Query() query: MetricsWindowDto,
  ) {
    return this.metrics.getServerResources(serverId, query.window);
  }

  @Get('servers/:serverId/series')
  getServerSeries(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Query() query: MetricsWindowDto,
  ) {
    return this.metrics.getServerSeries(serverId, query.window);
  }

  @Get('resources/:resourceId/series')
  getResourceSeries(
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Query() query: MetricsWindowDto,
  ) {
    if (resourceId < 1) {
      throw appError('VAL_REQUEST');
    }
    return this.metrics.getResourceSeries(resourceId, query.window);
  }

  @Get('agent-tokens')
  listAgentTokens() {
    return this.metrics.listAgentTokens();
  }

  @Post('agent-tokens')
  createAgentToken(@Body() dto: CreateAgentTokenDto) {
    return this.metrics.createAgentToken(dto.serverName);
  }

  @Delete('agent-tokens/:id')
  @HttpCode(204)
  revokeAgentToken(@Param('id', ParseUUIDPipe) id: string) {
    return this.metrics.revokeAgentToken(id);
  }

  @Get('app-tokens')
  listAppTokens() {
    return this.metrics.listAppTokens();
  }

  @Post('app-tokens')
  createAppToken(@Body() dto: CreateAppTokenDto) {
    return this.metrics.createAppToken(dto.app);
  }

  @Delete('app-tokens/:id')
  @HttpCode(204)
  revokeAppToken(@Param('id', ParseUUIDPipe) id: string) {
    return this.metrics.revokeAppToken(id);
  }

  @Get('app-metrics')
  listAppMetrics(@Query('app') app?: string) {
    return this.metrics.listAppMetrics(app);
  }

  @Get('app-series')
  getAppSeries(@Query() query: AppSeriesQueryDto) {
    return this.metrics.getAppSeries(query.app, query.metric, query.window);
  }
}
