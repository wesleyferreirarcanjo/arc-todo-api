import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appError } from '../errors/app-errors';
import type { MetricsWindow } from './dto/metrics-window.dto';

@Injectable()
export class MetricsService {
  constructor(private readonly config: ConfigService) {}

  listServers() {
    return this.call('GET', '/v1/servers');
  }

  getServerResources(serverId: string, window: MetricsWindow) {
    return this.call(
      'GET',
      `/v1/servers/${encodeURIComponent(serverId)}/resources?window=${window}`,
    );
  }

  getServerSeries(serverId: string, window: MetricsWindow) {
    return this.call(
      'GET',
      `/v1/servers/${encodeURIComponent(serverId)}/series?window=${window}`,
    );
  }

  getResourceSeries(resourceId: number, window: MetricsWindow) {
    return this.call('GET', `/v1/resources/${resourceId}/series?window=${window}`);
  }

  listAgentTokens() {
    return this.call('GET', '/v1/tokens');
  }

  createAgentToken(serverName: string) {
    return this.call('POST', '/v1/tokens', { serverName });
  }

  revokeAgentToken(id: string) {
    return this.call('DELETE', `/v1/tokens/${encodeURIComponent(id)}`);
  }

  listAppTokens() {
    return this.call('GET', '/v1/app-tokens');
  }

  createAppToken(app: string) {
    return this.call('POST', '/v1/app-tokens', { app });
  }

  revokeAppToken(id: string) {
    return this.call('DELETE', `/v1/app-tokens/${encodeURIComponent(id)}`);
  }

  listAppMetrics(app?: string) {
    const qs = app ? `?app=${encodeURIComponent(app)}` : '';
    return this.call('GET', `/v1/app-metrics${qs}`);
  }

  getAppSeries(app: string, metric: string, window: MetricsWindow) {
    const params = new URLSearchParams({ app, metric, window });
    return this.call('GET', `/v1/app-series?${params.toString()}`);
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const base = this.config.get<string>('ARC_METRICS_URL')?.replace(/\/$/, '');
    const token = this.config.get<string>('ARC_METRICS_TOKEN');
    if (!base || !token) {
      throw appError('METRICS_NOT_CONFIGURED');
    }

    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw appError('METRICS_UNAVAILABLE');
    }

    if (response.status === 204) {
      return {};
    }
    if (response.status === 404) {
      throw appError('METRICS_NOT_FOUND');
    }
    if (response.status === 400 || response.status === 409) {
      throw new HttpException(
        { statusCode: response.status, message: await readServiceMessage(response) },
        response.status,
      );
    }
    if (!response.ok || response.status >= 500) {
      throw appError('METRICS_UNAVAILABLE');
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
