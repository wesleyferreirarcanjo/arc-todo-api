import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../projects/admin.guard';
import { CloudService, type CloudSource } from './cloud.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('cloud')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CloudController {
  constructor(private readonly cloud: CloudService) {}

  @Get('servers')
  listServers(@Req() req: AuthRequest, @Headers('x-arc-source') source?: string) {
    return this.cloud.listServers(req.user.id, cloudSource(source));
  }

  @Post('servers')
  createServer(
    @Req() req: AuthRequest,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.createServer(req.user.id, cloudSource(source), body);
  }

  @Get('servers/:id/containers')
  listContainers(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.listContainers(req.user.id, cloudSource(source), id);
  }

  @Post('servers/:id/refresh')
  refreshServer(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.refreshServer(req.user.id, cloudSource(source), id);
  }

  @Post('servers/:id/proxy')
  installProxy(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.ensureProxy(req.user.id, cloudSource(source), id);
  }

  @Get('servers/:id/proxy')
  proxyStatus(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.proxyStatus(req.user.id, cloudSource(source), id);
  }

  @Post('servers/:id/proxy/rollback')
  rollbackProxy(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.rollbackProxy(req.user.id, cloudSource(source), id);
  }

  @Delete('servers/:id')
  @HttpCode(204)
  removeServer(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.removeServer(req.user.id, cloudSource(source), id);
  }

  // ------------------------------------------------------------------
  // Apps
  // ------------------------------------------------------------------

  @Get('apps')
  listApps(
    @Req() req: AuthRequest,
    @Headers('x-arc-source') source?: string,
    @Query('serverId') serverId?: string,
  ) {
    return this.cloud.listApps(req.user.id, cloudSource(source), serverId);
  }

  @Post('apps')
  createApp(
    @Req() req: AuthRequest,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.createApp(req.user.id, cloudSource(source), body);
  }

  @Get('apps/:id')
  getApp(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.getApp(req.user.id, cloudSource(source), id);
  }

  @Patch('apps/:id')
  updateApp(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.updateApp(req.user.id, cloudSource(source), id, body);
  }

  @Delete('apps/:id')
  @HttpCode(204)
  deleteApp(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.deleteApp(req.user.id, cloudSource(source), id);
  }

  @Put('apps/:id/env')
  setEnv(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { env: Record<string, string> },
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.setEnv(req.user.id, cloudSource(source), id, body.env ?? {});
  }

  @Get('apps/:id/env')
  getEnv(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
    @Query('reveal') reveal?: string,
  ) {
    return this.cloud.getEnv(req.user.id, cloudSource(source), id, reveal === 'true');
  }

  @Post('apps/:id/deploy')
  deploy(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { imageRef?: string },
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.deploy(req.user.id, cloudSource(source), id, body?.imageRef);
  }

  @Post('apps/:id/rollback')
  rollback(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.rollback(req.user.id, cloudSource(source), id);
  }

  @Post('apps/:id/restart')
  restart(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.lifecycle(req.user.id, cloudSource(source), id, 'restart');
  }

  @Post('apps/:id/stop')
  stop(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.lifecycle(req.user.id, cloudSource(source), id, 'stop');
  }

  @Post('apps/:id/start')
  start(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.lifecycle(req.user.id, cloudSource(source), id, 'start');
  }

  @Get('apps/:id/deployments')
  listDeployments(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.listDeployments(req.user.id, cloudSource(source), id);
  }

  @Get('apps/:id/logs')
  appLogs(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
    @Query('tail') tail?: string,
  ) {
    const parsed = tail ? Number.parseInt(tail, 10) : undefined;
    return this.cloud.appLogs(
      req.user.id,
      cloudSource(source),
      id,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  // ------------------------------------------------------------------
  // Git builds
  // ------------------------------------------------------------------

  @Put('apps/:id/source')
  setAppSource(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.setAppSource(req.user.id, cloudSource(source), id, body ?? {});
  }

  @Put('apps/:id/build-policy')
  setBuildPolicy(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.setBuildPolicy(req.user.id, cloudSource(source), id, body ?? {});
  }

  @Put('apps/:id/registry')
  setRegistry(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.setRegistry(req.user.id, cloudSource(source), id, body ?? {});
  }

  @Post('apps/:id/build-deploy')
  buildDeploy(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { ref?: string },
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.buildDeploy(req.user.id, cloudSource(source), id, body?.ref);
  }

  @Post('apps/:id/deploy-key')
  createDeployKey(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.createDeployKey(req.user.id, cloudSource(source), id);
  }

  @Put('servers/:id/build-settings')
  setBuildSettings(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.setBuildSettings(req.user.id, cloudSource(source), id, body ?? {});
  }

  @Put('servers/:id/checkouts/:appId')
  setBuildCheckout(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('appId', ParseUUIDPipe) appId: string,
    @Body() body: { path?: string },
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.setBuildCheckout(
      req.user.id,
      cloudSource(source),
      id,
      appId,
      body?.path ?? '',
    );
  }

  @Get('github-app')
  githubAppStatus(@Req() req: AuthRequest, @Headers('x-arc-source') source?: string) {
    return this.cloud.githubAppStatus(req.user.id, cloudSource(source));
  }

  // ------------------------------------------------------------------
  // Panel import — read-only Coolify/Easypanel reads, draft apps.
  // ------------------------------------------------------------------

  @Get('panels')
  listPanels(@Req() req: AuthRequest, @Headers('x-arc-source') source?: string) {
    return this.cloud.listPanels(req.user.id, cloudSource(source));
  }

  @Put('panels/:panel')
  updatePanel(
    @Req() req: AuthRequest,
    @Param('panel') panel: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.updatePanel(req.user.id, cloudSource(source), panel, body ?? {});
  }

  @Get('coolify/apps')
  listCoolifyApps(@Req() req: AuthRequest, @Headers('x-arc-source') source?: string) {
    return this.cloud.listCoolifyApps(req.user.id, cloudSource(source));
  }

  @Post('coolify/apps/:uuid/import')
  importCoolifyApp(
    @Req() req: AuthRequest,
    @Param('uuid') uuid: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.importCoolifyApp(req.user.id, cloudSource(source), uuid, body ?? {});
  }

  @Get('easypanel/apps')
  listEasypanelApps(@Req() req: AuthRequest, @Headers('x-arc-source') source?: string) {
    return this.cloud.listEasypanelApps(req.user.id, cloudSource(source));
  }

  @Post('easypanel/apps/:project/:service/import')
  importEasypanelApp(
    @Req() req: AuthRequest,
    @Param('project') project: string,
    @Param('service') service: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.importEasypanelApp(
      req.user.id,
      cloudSource(source),
      project,
      service,
      body ?? {},
    );
  }

  @Post('apps/:id/confirm-import')
  confirmImport(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.confirmImport(req.user.id, cloudSource(source), id);
  }


  @Put('github-app')
  updateGithubApp(
    @Req() req: AuthRequest,
    @Body() body: Record<string, unknown>,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.updateGithubApp(req.user.id, cloudSource(source), body ?? {});
  }

  @Get('deployments/:id')
  getDeployment(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source?: string,
  ) {
    return this.cloud.getDeployment(req.user.id, cloudSource(source), id);
  }

  /** SSE proxy — streams the master's deploy log to the browser. */
  @Get('deployments/:id/stream')
  async deploymentStream(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-arc-source') source: string | undefined,
    @Res() res: Response,
  ) {
    const upstream = await this.cloud.deploymentStream(req.user.id, cloudSource(source), id);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const stream = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
    req.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}

// Only the two audit values are forwarded; anything else falls back to `ui`.
function cloudSource(raw: string | undefined): CloudSource {
  return raw === 'mcp' ? 'mcp' : 'ui';
}
