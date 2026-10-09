import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../projects/admin.guard';
import { CreateAgentTokenDto } from './dto/create-agent-token.dto';
import { CreateAppTokenDto } from './dto/create-app-token.dto';
import { ExplainLogsDto } from './dto/explain-logs.dto';
import { SearchLogsDto } from './dto/search-logs.dto';
import { ObserverService } from './observer.service';

@Controller('observer')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ObserverController {
  constructor(private readonly observer: ObserverService) {}

  @Get('servers')
  listServers() {
    return this.observer.listServers();
  }

  @Get('servers/:serverId/apps')
  listApps(@Param('serverId', ParseUUIDPipe) serverId: string) {
    return this.observer.listApps(serverId);
  }

  @Get('apps')
  listSdkApps() {
    return this.observer.listSdkApps();
  }

  @Get('logs')
  search(@Query() query: SearchLogsDto) {
    return this.observer.search(query);
  }

  @Get('tail')
  tail(@Query() query: SearchLogsDto) {
    return this.observer.tail(query);
  }

  @Post('explain')
  explain(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: ExplainLogsDto,
  ) {
    return this.observer.explain(authorization, dto);
  }

  @Get('agent-tokens')
  listAgentTokens() {
    return this.observer.listAgentTokens();
  }

  @Post('agent-tokens')
  createAgentToken(@Body() dto: CreateAgentTokenDto) {
    return this.observer.createAgentToken(dto.serverName);
  }

  @Delete('agent-tokens/:id')
  @HttpCode(204)
  revokeAgentToken(@Param('id', ParseUUIDPipe) id: string) {
    return this.observer.revokeAgentToken(id);
  }

  @Get('app-tokens')
  listAppTokens() {
    return this.observer.listAppTokens();
  }

  @Post('app-tokens')
  createAppToken(@Body() dto: CreateAppTokenDto) {
    return this.observer.createAppToken(dto.app);
  }

  @Delete('app-tokens/:id')
  @HttpCode(204)
  revokeAppToken(@Param('id', ParseUUIDPipe) id: string) {
    return this.observer.revokeAppToken(id);
  }
}
