export const BUG_RUNTIME_WINDOW_MS = 120_000;
export const OBSERVER_LOG_FILENAME = 'observer-log.json';
export const METRICS_WINDOW_FILENAME = 'metrics-window.json';
export const OBSERVER_SEARCH_LIMIT = '1000';

export type QaEnvironmentUrl = { url?: unknown };

export type CloudAppListItem = {
  id: string;
  name: string;
  serverId: string;
  domains: string[];
};

export type MetricsResourceRow = {
  resourceId?: unknown;
  key?: unknown;
  type?: unknown;
  project?: unknown;
  resource?: unknown;
  service?: unknown;
  restarts?: unknown;
  oomKills?: unknown;
};

export type BugRuntimeEvidenceContext = {
  userId: string;
  orgId: string;
  projectId: string;
  taskId: string;
};

export type BugRuntimeEvidenceDeps = {
  getQaEnvironments: () => Promise<QaEnvironmentUrl[]>;
  listCloudApps: () => Promise<CloudAppListItem[]>;
  searchObserver: (query: {
    app: string;
    fromMs: string;
    toMs: string;
    limit: string;
  }) => Promise<unknown>;
  listMetricsServers: () => Promise<{ id: string }[]>;
  getServerResources: (serverId: string, window: '1h') => Promise<unknown>;
  getResourceSeries: (resourceId: number, window: '1h') => Promise<unknown>;
  uploadJson: (filename: string, body: unknown) => Promise<void>;
  logWarn: (message: string) => void;
  nowMs?: () => number;
};

export function parseHttpHostname(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.trim().toLowerCase().replace(/\.$/, '');
    return host || null;
  } catch {
    return null;
  }
}

/**
 * ponytail: several QA environments → first http(s) URL only. Ceiling: the
 * wrong Cloud app is attached when staging is listed after production.
 * Upgrade: an explicit environment picker on the bug-flag / QA info UI.
 */
export function firstQaEnvironmentHost(
  environments: QaEnvironmentUrl[],
): string | null {
  for (const item of environments) {
    if (typeof item?.url !== 'string') continue;
    const trimmed = item.url.trim();
    if (!/^https?:\/\//i.test(trimmed)) continue;
    const host = parseHttpHostname(trimmed);
    if (host) return host;
  }
  return null;
}

export function domainMatchesHost(domain: string, host: string): boolean {
  const normalizedHost = host.trim().toLowerCase().replace(/\.$/, '');
  if (!normalizedHost) return false;
  const domainHost = parseHttpHostname(domain) ?? domain.trim().toLowerCase().replace(/\.$/, '');
  if (!domainHost) return false;
  if (domainHost === normalizedHost) return true;
  if (domainHost.startsWith('*.')) {
    const suffix = domainHost.slice(1);
    return (
      normalizedHost.endsWith(suffix) && normalizedHost.length > suffix.length
    );
  }
  return false;
}

export function findCloudAppForHost(
  apps: CloudAppListItem[],
  host: string,
): CloudAppListItem | null {
  for (const app of apps) {
    if (app.domains.some((domain) => domainMatchesHost(domain, host))) {
      return app;
    }
  }
  return null;
}

export function asCloudApps(payload: unknown): CloudAppListItem[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { apps?: unknown }).apps)
      ? ((payload as { apps: unknown[] }).apps)
      : [];
  const apps: CloudAppListItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    if (typeof rec.id !== 'string' || typeof rec.name !== 'string') continue;
    const serverId = typeof rec.serverId === 'string' ? rec.serverId : '';
    const domains = Array.isArray(rec.domains)
      ? rec.domains.filter((d): d is string => typeof d === 'string')
      : [];
    apps.push({ id: rec.id, name: rec.name, serverId, domains });
  }
  return apps;
}

export function asIdList(payload: unknown): { id: string }[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter(
    (row): row is { id: string } =>
      !!row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string',
  );
}

export function metricsResourceMatchesCloudApp(
  resource: MetricsResourceRow,
  app: CloudAppListItem,
): boolean {
  const key = typeof resource.key === 'string' ? resource.key : '';
  if (
    key.startsWith(`arccloud:${app.id}:`) ||
    key.startsWith(`arccloud:${app.name}:`)
  ) {
    return true;
  }
  const slug = typeof resource.resource === 'string' ? resource.resource : '';
  return resource.type === 'arccloud' && (slug === app.id || slug === app.name);
}

export function nullableCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function sliceSeriesPoints(
  points: unknown,
  fromMs: number,
  toMs: number,
): unknown[] {
  if (!Array.isArray(points)) return [];
  return points.filter((point) => {
    if (!point || typeof point !== 'object') return false;
    const ms = parsePointTime((point as { t?: unknown }).t);
    return ms !== null && ms >= fromMs && ms <= toMs;
  });
}

export function fireAndForgetBugRuntimeEvidence(
  flagged: boolean,
  attach: () => Promise<void>,
  onError: (err: unknown) => void,
): void {
  if (!flagged) return;
  void attach().catch(onError);
}

export async function attachBugRuntimeEvidence(
  deps: BugRuntimeEvidenceDeps,
  ctx: BugRuntimeEvidenceContext,
): Promise<void> {
  try {
    await attachMapped(deps, ctx);
  } catch (err) {
    deps.logWarn(
      `Bug runtime evidence skipped for task ${ctx.taskId}: ${errorMessage(err)}`,
    );
  }
}

async function attachMapped(
  deps: BugRuntimeEvidenceDeps,
  ctx: BugRuntimeEvidenceContext,
): Promise<void> {
  const environments = await deps.getQaEnvironments();
  const host = firstQaEnvironmentHost(environments);
  if (!host) return;

  const app = findCloudAppForHost(await deps.listCloudApps(), host);
  if (!app) return;

  const toMs = (deps.nowMs ?? Date.now)();
  const fromMs = toMs - BUG_RUNTIME_WINDOW_MS;

  await attachObserverLog(deps, app, fromMs, toMs);
  await attachMetricsWindow(deps, app, fromMs, toMs);
}

async function attachObserverLog(
  deps: BugRuntimeEvidenceDeps,
  app: CloudAppListItem,
  fromMs: number,
  toMs: number,
): Promise<void> {
  try {
    const page = await deps.searchObserver({
      app: app.id,
      fromMs: String(fromMs),
      toMs: String(toMs),
      limit: OBSERVER_SEARCH_LIMIT,
    });
    const lines =
      page &&
      typeof page === 'object' &&
      Array.isArray((page as { lines?: unknown }).lines)
        ? (page as { lines: unknown[] }).lines
        : [];
    await deps.uploadJson(OBSERVER_LOG_FILENAME, {
      fromMs,
      toMs,
      app: app.id,
      lines,
    });
  } catch (err) {
    deps.logWarn(`Observer log attach failed: ${errorMessage(err)}`);
  }
}

async function attachMetricsWindow(
  deps: BugRuntimeEvidenceDeps,
  app: CloudAppListItem,
  fromMs: number,
  toMs: number,
): Promise<void> {
  try {
    const serverIds = uniqueIds(
      (await deps.listMetricsServers()).map((row) => row.id),
    );
    const resources: unknown[] = [];
    for (const serverId of serverIds) {
      let rows: MetricsResourceRow[];
      try {
        rows = asResourceRows(await deps.getServerResources(serverId, '1h'));
      } catch (err) {
        deps.logWarn(
          `Metrics resources skipped for server ${serverId}: ${errorMessage(err)}`,
        );
        continue;
      }
      for (const row of rows) {
        if (!metricsResourceMatchesCloudApp(row, app)) continue;
        const resourceId =
          typeof row.resourceId === 'number' ? row.resourceId : null;
        let series: unknown = null;
        if (resourceId !== null) {
          try {
            const raw = await deps.getResourceSeries(resourceId, '1h');
            series = sliceSeriesView(raw, fromMs, toMs);
          } catch (err) {
            deps.logWarn(
              `Metrics series skipped for resource ${resourceId}: ${errorMessage(err)}`,
            );
          }
        }
        resources.push({
          resourceId,
          key: typeof row.key === 'string' ? row.key : null,
          type: typeof row.type === 'string' ? row.type : null,
          resource: typeof row.resource === 'string' ? row.resource : null,
          service: typeof row.service === 'string' ? row.service : null,
          restarts: nullableCount(row.restarts),
          oomKills: nullableCount(row.oomKills),
          series,
        });
      }
    }
    await deps.uploadJson(METRICS_WINDOW_FILENAME, {
      fromMs,
      toMs,
      cloudAppId: app.id,
      cloudAppName: app.name,
      resources,
    });
  } catch (err) {
    deps.logWarn(`Metrics window attach failed: ${errorMessage(err)}`);
  }
}

function sliceSeriesView(
  raw: unknown,
  fromMs: number,
  toMs: number,
): { resolutionSecs: unknown; points: unknown[] } {
  const view =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    resolutionSecs: view.resolutionSecs ?? null,
    points: sliceSeriesPoints(view.points, fromMs, toMs),
  };
}

function asResourceRows(payload: unknown): MetricsResourceRow[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter(
    (row): row is MetricsResourceRow => !!row && typeof row === 'object',
  );
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function parsePointTime(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return String(err);
}

if (require.main === module) {
  void (async () => {
    const checks: Array<[string, boolean]> = [];

    const host = parseHttpHostname('https://app.example.com/path');
    checks.push(['host parse', host === 'app.example.com']);
    checks.push([
      'host matches cloud domain',
      host !== null && domainMatchesHost('app.example.com', host),
    ]);
    checks.push([
      'mapped app',
      findCloudAppForHost(
        [
          {
            id: 'app-1',
            name: 'shop',
            serverId: 'srv-1',
            domains: ['app.example.com'],
          },
        ],
        'app.example.com',
      )?.id === 'app-1',
    ]);
    checks.push([
      'unmapped host',
      findCloudAppForHost(
        [
          {
            id: 'app-1',
            name: 'shop',
            serverId: 'srv-1',
            domains: ['other.example.com'],
          },
        ],
        'app.example.com',
      ) === null,
    ]);
    checks.push([
      'first environment host',
      firstQaEnvironmentHost([
        { url: 'not-a-url' },
        { url: 'https://app.example.com/path' },
        { url: 'https://staging.example.com' },
      ]) === 'app.example.com',
    ]);

    const fromMs = Date.parse('2026-10-23T14:00:00.000Z');
    const toMs = fromMs + BUG_RUNTIME_WINDOW_MS;
    const sliced = sliceSeriesPoints(
      [
        { t: '2026-10-23T13:50:00.000Z', cpuMcores: 1 },
        { t: '2026-10-23T14:01:00.000Z', cpuMcores: 2 },
        { t: '2026-10-23T14:10:00.000Z', cpuMcores: 3 },
      ],
      fromMs,
      toMs,
    );
    checks.push([
      'slice last 2 minutes',
      sliced.length === 1 &&
        (sliced[0] as { cpuMcores: number }).cpuMcores === 2,
    ]);
    checks.push(['missing oom is null', nullableCount(undefined) === null]);
    checks.push(['present restarts kept', nullableCount(3) === 3]);

    const uploads: string[] = [];
    const observerCalls: number[] = [];
    const throwingObserver: BugRuntimeEvidenceDeps = {
      getQaEnvironments: async () => [
        { url: 'https://app.example.com/path' },
      ],
      listCloudApps: async () => [
        {
          id: 'app-1',
          name: 'shop',
          serverId: 'srv-1',
          domains: ['app.example.com'],
        },
      ],
      searchObserver: async () => {
        observerCalls.push(1);
        throw new Error('OBSERVER_UNAVAILABLE');
      },
      listMetricsServers: async () => [{ id: 'metrics-1' }],
      getServerResources: async () => [
        {
          resourceId: 9,
          key: 'arccloud:app-1:web',
          type: 'arccloud',
          resource: 'shop',
          restarts: 1,
          oomKills: null,
        },
      ],
      getResourceSeries: async () => ({
        resolutionSecs: 15,
        points: [{ t: '2026-10-23T14:01:00.000Z', cpuMcores: 4 }],
      }),
      uploadJson: async (filename) => {
        uploads.push(filename);
      },
      logWarn: () => undefined,
      nowMs: () => Date.parse('2026-10-23T14:02:00.000Z'),
    };

    const saved = { isBug: false, bugReason: null as string | null };
    let attachDone: Promise<void> = Promise.resolve();
    async function updateTask(dto: { isBug?: boolean; bugReason?: string }) {
      if (dto.isBug) {
        const reason = dto.bugReason?.trim() || null;
        if (!reason) throw new Error('TASK_BUG_REASON_REQUIRED');
        saved.isBug = true;
        saved.bugReason = reason;
      }
      const result = { isBug: saved.isBug, bugReason: saved.bugReason };
      fireAndForgetBugRuntimeEvidence(
        dto.isBug === true,
        () => {
          attachDone = attachBugRuntimeEvidence(throwingObserver, {
            userId: 'u1',
            orgId: 'o1',
            projectId: 'p1',
            taskId: 't1',
          });
          return attachDone;
        },
        () => {
          throw new Error('attach rejection must not reach updateTask');
        },
      );
      return result;
    }

    const flagged = await updateTask({ isBug: true, bugReason: 'x' });
    checks.push(['updateTask saves isBug when Observer throws', flagged.isBug === true]);
    await attachDone;
    checks.push(['observer was called', observerCalls.length === 1]);
    checks.push([
      'observer file skipped on throw',
      !uploads.includes(OBSERVER_LOG_FILENAME),
    ]);
    checks.push([
      'metrics file still stored',
      uploads.includes(METRICS_WINDOW_FILENAME),
    ]);

    const unmappedUploads: string[] = [];
    let unmappedThrew = false;
    try {
      await attachBugRuntimeEvidence(
        {
          ...throwingObserver,
          getQaEnvironments: async () => [{ url: 'https://orphan.example.com' }],
          listCloudApps: async () => [
            {
              id: 'app-1',
              name: 'shop',
              serverId: 'srv-1',
              domains: ['app.example.com'],
            },
          ],
          uploadJson: async (filename) => {
            unmappedUploads.push(filename);
          },
        },
        {
          userId: 'u1',
          orgId: 'o1',
          projectId: 'p1',
          taskId: 't1',
        },
      );
    } catch {
      unmappedThrew = true;
    }
    checks.push(['unmapped does not throw', unmappedThrew === false]);
    checks.push(['unmapped stores no files', unmappedUploads.length === 0]);

    const failed = checks.filter(([, ok]) => !ok);
    if (failed.length) {
      console.error(
        'bug-runtime-evidence.util failed:',
        failed.map(([name]) => name).join(', '),
      );
      process.exit(1);
    }
    console.log(`bug-runtime-evidence.util ok (${checks.length})`);
  })();
}
