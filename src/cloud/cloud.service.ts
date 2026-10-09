import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appError } from '../errors/app-errors';

/** Call origin forwarded to the arc-cloud master for its audit log. */
export type CloudSource = 'ui' | 'mcp';

@Injectable()
export class CloudService {
  constructor(private readonly config: ConfigService) {}

  listServers(actor: string, source: CloudSource) {
    return this.call(actor, source, 'GET', '/v1/servers');
  }

  createServer(actor: string, source: CloudSource, body: Record<string, unknown>) {
    return this.call(actor, source, 'POST', '/v1/servers', body);
  }

  listContainers(actor: string, source: CloudSource, serverId: string) {
    return this.call(
      actor,
      source,
      'GET',
      `/v1/servers/${encodeURIComponent(serverId)}/containers`,
    );
  }

  refreshServer(actor: string, source: CloudSource, serverId: string) {
    return this.call(
      actor,
      source,
      'POST',
      `/v1/servers/${encodeURIComponent(serverId)}/refresh`,
    );
  }

  ensureProxy(actor: string, source: CloudSource, serverId: string) {
    return this.call(
      actor,
      source,
      'POST',
      `/v1/servers/${encodeURIComponent(serverId)}/proxy`,
    );
  }

  proxyStatus(actor: string, source: CloudSource, serverId: string) {
    return this.call(
      actor,
      source,
      'GET',
      `/v1/servers/${encodeURIComponent(serverId)}/proxy`,
    );
  }

  rollbackProxy(actor: string, source: CloudSource, serverId: string) {
    return this.call(
      actor,
      source,
      'POST',
      `/v1/servers/${encodeURIComponent(serverId)}/proxy/rollback`,
    );
  }

  removeServer(actor: string, source: CloudSource, serverId: string) {
    return this.call(
      actor,
      source,
      'DELETE',
      `/v1/servers/${encodeURIComponent(serverId)}`,
    );
  }

  // ------------------------------------------------------------------
  // Apps
  // ------------------------------------------------------------------

  listApps(actor: string, source: CloudSource, serverId?: string) {
    const query = serverId ? `?server_id=${encodeURIComponent(serverId)}` : '';
    return this.call(actor, source, 'GET', `/v1/apps${query}`);
  }

  createApp(actor: string, source: CloudSource, body: Record<string, unknown>) {
    return this.call(actor, source, 'POST', '/v1/apps', body);
  }

  getApp(actor: string, source: CloudSource, appId: string) {
    return this.call(actor, source, 'GET', this.appPath(appId));
  }

  updateApp(
    actor: string,
    source: CloudSource,
    appId: string,
    body: Record<string, unknown>,
  ) {
    return this.call(actor, source, 'PATCH', this.appPath(appId), body);
  }

  deleteApp(actor: string, source: CloudSource, appId: string) {
    return this.call(actor, source, 'DELETE', this.appPath(appId));
  }

  setEnv(actor: string, source: CloudSource, appId: string, env: Record<string, string>) {
    return this.call(actor, source, 'PUT', `${this.appPath(appId)}/env`, { env });
  }

  getEnv(actor: string, source: CloudSource, appId: string, reveal: boolean) {
    const query = reveal ? '?reveal=true' : '';
    return this.call(actor, source, 'GET', `${this.appPath(appId)}/env${query}`);
  }

  deploy(actor: string, source: CloudSource, appId: string, imageRef?: string) {
    return this.call(
      actor,
      source,
      'POST',
      `${this.appPath(appId)}/deploy`,
      imageRef ? { imageRef } : {},
    );
  }

  rollback(actor: string, source: CloudSource, appId: string) {
    return this.call(actor, source, 'POST', `${this.appPath(appId)}/rollback`, {});
  }

  lifecycle(actor: string, source: CloudSource, appId: string, verb: 'restart' | 'stop' | 'start') {
    return this.call(actor, source, 'POST', `${this.appPath(appId)}/${verb}`, {});
  }

  listDeployments(actor: string, source: CloudSource, appId: string) {
    return this.call(actor, source, 'GET', `${this.appPath(appId)}/deployments`);
  }

  getDeployment(actor: string, source: CloudSource, deploymentId: string) {
    return this.call(
      actor,
      source,
      'GET',
      `/v1/deployments/${encodeURIComponent(deploymentId)}`,
    );
  }

  appLogs(actor: string, source: CloudSource, appId: string, tail?: number) {
    const query = tail ? `?tail=${tail}` : '';
    return this.call(actor, source, 'GET', `${this.appPath(appId)}/logs${query}`);
  }

  // ------------------------------------------------------------------
  // Git builds — source, registry, build policy, machines, GitHub App.
  // ------------------------------------------------------------------

  setAppSource(actor: string, source: CloudSource, appId: string, body: Record<string, unknown>) {
    return this.call(actor, source, 'PUT', `${this.appPath(appId)}/source`, body);
  }

  setBuildPolicy(
    actor: string,
    source: CloudSource,
    appId: string,
    body: Record<string, unknown>,
  ) {
    return this.call(actor, source, 'PUT', `${this.appPath(appId)}/build-policy`, body);
  }

  setRegistry(actor: string, source: CloudSource, appId: string, body: Record<string, unknown>) {
    return this.call(actor, source, 'PUT', `${this.appPath(appId)}/registry`, body);
  }

  buildDeploy(actor: string, source: CloudSource, appId: string, ref?: string) {
    return this.call(
      actor,
      source,
      'POST',
      `${this.appPath(appId)}/build-deploy`,
      ref ? { ref } : {},
    );
  }

  createDeployKey(actor: string, source: CloudSource, appId: string) {
    return this.call(actor, source, 'POST', `${this.appPath(appId)}/deploy-key`, {});
  }

  setBuildSettings(
    actor: string,
    source: CloudSource,
    serverId: string,
    body: Record<string, unknown>,
  ) {
    return this.call(
      actor,
      source,
      'PUT',
      `/v1/servers/${encodeURIComponent(serverId)}/build-settings`,
      body,
    );
  }

  setBuildCheckout(
    actor: string,
    source: CloudSource,
    serverId: string,
    appId: string,
    path: string,
  ) {
    return this.call(
      actor,
      source,
      'PUT',
      `/v1/servers/${encodeURIComponent(serverId)}/checkouts/${encodeURIComponent(appId)}`,
      { path },
    );
  }

  githubAppStatus(actor: string, source: CloudSource) {
    return this.call(actor, source, 'GET', '/v1/github-app');
  }

  // ------------------------------------------------------------------
  // Panel import — Coolify / Easypanel (read-only upstream, draft apps)
  // ------------------------------------------------------------------

  listPanels(actor: string, source: CloudSource) {
    return this.call(actor, source, 'GET', '/v1/panels');
  }

  updatePanel(actor: string, source: CloudSource, panel: string, body: Record<string, unknown>) {
    return this.call(actor, source, 'PUT', `/v1/panels/${encodeURIComponent(panel)}`, body);
  }

  listCoolifyApps(actor: string, source: CloudSource) {
    return this.call(actor, source, 'GET', '/v1/import/coolify/apps');
  }

  importCoolifyApp(actor: string, source: CloudSource, uuid: string, body: Record<string, unknown>) {
    return this.call(
      actor,
      source,
      'POST',
      `/v1/import/coolify/apps/${encodeURIComponent(uuid)}`,
      body,
    );
  }

  listEasypanelApps(actor: string, source: CloudSource) {
    return this.call(actor, source, 'GET', '/v1/import/easypanel/apps');
  }

  importEasypanelApp(
    actor: string,
    source: CloudSource,
    project: string,
    service: string,
    body: Record<string, unknown>,
  ) {
    return this.call(
      actor,
      source,
      'POST',
      `/v1/import/easypanel/apps/${encodeURIComponent(project)}/${encodeURIComponent(service)}`,
      body,
    );
  }

  confirmImport(actor: string, source: CloudSource, appId: string) {
    return this.call(actor, source, 'POST', `${this.appPath(appId)}/confirm-import`, {});
  }


  updateGithubApp(actor: string, source: CloudSource, body: Record<string, unknown>) {
    return this.call(actor, source, 'PUT', '/v1/github-app', body);
  }

  /** Raw upstream response for the SSE deploy-log stream — not JSON. */
  async deploymentStream(actor: string, source: CloudSource, deploymentId: string) {
    const base = this.config.get<string>('ARC_CLOUD_URL')?.replace(/\/$/, '');
    const token = this.config.get<string>('ARC_CLOUD_TOKEN');
    if (!base || !token) {
      throw appError('CLOUD_NOT_CONFIGURED');
    }
    let response: Response;
    try {
      response = await fetch(
        `${base}/v1/deployments/${encodeURIComponent(deploymentId)}/stream`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Arc-Actor': actor,
            'X-Arc-Source': source,
          },
        },
      );
    } catch {
      throw appError('CLOUD_UNAVAILABLE');
    }
    if (response.status === 404) {
      throw appError('CLOUD_NOT_FOUND');
    }
    if (!response.ok) {
      throw appError('CLOUD_UNAVAILABLE');
    }
    return response;
  }

  private appPath(appId: string) {
    return `/v1/apps/${encodeURIComponent(appId)}`;
  }

  private async call(
    actor: string,
    source: CloudSource,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const base = this.config.get<string>('ARC_CLOUD_URL')?.replace(/\/$/, '');
    const token = this.config.get<string>('ARC_CLOUD_TOKEN');
    if (!base || !token) {
      throw appError('CLOUD_NOT_CONFIGURED');
    }

    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'X-Arc-Actor': actor,
          'X-Arc-Source': source,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw appError('CLOUD_UNAVAILABLE');
    }

    if (response.status === 204) {
      return {};
    }
    if (response.status === 404) {
      throw appError('CLOUD_NOT_FOUND');
    }
    if (response.status === 400 || response.status === 409) {
      throw new HttpException(
        { statusCode: response.status, message: await readServiceMessage(response) },
        response.status,
      );
    }
    if (!response.ok || response.status >= 500) {
      throw appError('CLOUD_UNAVAILABLE');
    }
    return response.json();
  }
}

async function readServiceMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = (data as { message: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  } catch {
    // Body is not JSON; fall through to a generic status phrase.
  }
  return response.status === 409 ? 'Conflict' : 'Bad Request';
}
