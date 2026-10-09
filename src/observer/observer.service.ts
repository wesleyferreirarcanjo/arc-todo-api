import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appError } from '../errors/app-errors';
import type { ExplainLogsDto } from './dto/explain-logs.dto';
import type { SearchLogsDto } from './dto/search-logs.dto';

interface ObserverLogLine {
  ts: string;
  /** null for source='sdk' lines, which arrive without an agent server. */
  server: string | null;
  app: string | null;
  container: string;
  name: string;
  stream: string;
  level: string;
  message: string;
  /** 'agent' (Docker tail) or 'sdk' (in-app ingest). */
  source: string;
}

interface ObserverLogPage {
  lines: ObserverLogLine[];
  hasMore: boolean;
}

const EXPLAIN_MAX_LINES = 100;
const EXPLAIN_LINE_CHARS = 500;

@Injectable()
export class ObserverService {
  constructor(private readonly config: ConfigService) {}

  listServers() {
    return this.call('GET', '/v1/servers');
  }

  listApps(serverId: string) {
    return this.call('GET', `/v1/servers/${encodeURIComponent(serverId)}/apps`);
  }

  /** SDK apps that ingest via POST /v1/apps/ingest/logs (aap_ tokens). */
  listSdkApps() {
    return this.call('GET', '/v1/apps');
  }

  search(query: SearchLogsDto) {
    return this.call('GET', `/v1/logs${toQueryString(query)}`);
  }

  tail(query: SearchLogsDto) {
    return this.call('GET', `/v1/tail${toQueryString(query)}`);
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

  /**
   * Explain recent error lines through arc-todo-chatbot (DeepSeek).
   * The caller's JWT is forwarded so the chatbot acts as that admin user.
   */
  async explain(authorization: string | undefined, dto: ExplainLogsDto) {
    const minutes = dto.minutes ?? 60;
    const toMs = Date.now();
    const fromMs = toMs - minutes * 60_000;
    const params = new URLSearchParams({
      level: 'error',
      fromMs: String(fromMs),
      limit: String(EXPLAIN_MAX_LINES),
    });
    if (dto.serverId) params.set('server', dto.serverId);
    if (dto.app) params.set('app', dto.app);
    if (dto.query) params.set('q', dto.query);

    const page = (await this.call('GET', `/v1/logs?${params}`)) as ObserverLogPage;
    const lines = (page.lines ?? []).slice().reverse(); // oldest → newest

    const chatbotBase = this.config
      .get<string>('ARC_CHATBOT_URL')
      ?.replace(/\/$/, '');
    if (!chatbotBase || !authorization) {
      throw appError('OBSERVER_NOT_CONFIGURED');
    }

    const response = await this.postChat(chatbotBase, authorization, {
      messages: [{ role: 'user', content: buildExplainPrompt(lines, dto, minutes) }],
    });
    if (!response.ok) {
      throw appError('OBSERVER_UNAVAILABLE');
    }
    const data = (await response.json()) as {
      message?: string;
      usedTools?: string[];
    };
    return {
      explanation: data.message ?? '',
      usedTools: data.usedTools ?? [],
      linesUsed: lines.length,
      fromMs,
      toMs,
    };
  }

  private async postChat(
    base: string,
    authorization: string,
    body: unknown,
  ): Promise<Response> {
    try {
      return await fetch(`${base}/chat`, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw appError('OBSERVER_UNAVAILABLE');
    }
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const base = this.config.get<string>('ARC_OBSERVER_URL')?.replace(/\/$/, '');
    const token = this.config.get<string>('ARC_OBSERVER_TOKEN');
    if (!base || !token) {
      throw appError('OBSERVER_NOT_CONFIGURED');
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
      throw appError('OBSERVER_UNAVAILABLE');
    }

    if (response.status === 204) {
      return {};
    }
    if (response.status === 404) {
      throw appError('OBSERVER_NOT_FOUND');
    }
    if (response.status === 400 || response.status === 409) {
      throw new HttpException(
        { statusCode: response.status, message: await readServiceMessage(response) },
        response.status,
      );
    }
    if (!response.ok || response.status >= 500) {
      throw appError('OBSERVER_UNAVAILABLE');
    }
    return response.json();
  }
}

function toQueryString(query: SearchLogsDto): string {
  const params = new URLSearchParams();
  const map: Record<string, string | undefined> = {
    server: query.server,
    app: query.app,
    q: query.q,
    level: query.level,
    fromMs: query.fromMs,
    toMs: query.toMs,
    beforeMs: query.beforeMs,
    afterMs: query.afterMs,
    limit: query.limit,
  };
  for (const [key, value] of Object.entries(map)) {
    if (value !== undefined && value !== '') {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function buildExplainPrompt(
  lines: ObserverLogLine[],
  dto: ExplainLogsDto,
  minutes: number,
): string {
  const scope = [
    dto.serverId ? `server=${dto.serverId}` : null,
    dto.app ? `app=${dto.app}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const rendered = lines
    .map(
      (l) =>
        `${l.ts} [${l.level}] ${l.server ?? 'sdk'}/${l.app ?? l.name} ${l.stream}: ${l.message.slice(0, EXPLAIN_LINE_CHARS)}`,
    )
    .join('\n');
  const body =
    lines.length === 0
      ? 'No error-level log lines were found in the window.'
      : `Error lines (oldest to newest):\n${rendered}`;
  return [
    'You are analysing logs collected by arc-observer, the log service of the Arc platform.',
    `Scope: ${scope || 'all servers'}; window: last ${minutes} minutes.`,
    dto.query ? `Question: ${dto.query}` : 'Explain what is failing, the most likely cause, and a concrete fix.',
    'Cite the log timestamps you base the conclusion on. Be concise.',
    body,
  ].join('\n');
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
