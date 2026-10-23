export const REMOTE_ACTIONS = [
  'notify',
  'open_ui',
  'pause_new_sessions',
  'request_cancel_session',
] as const;

export type RemoteAction = (typeof REMOTE_ACTIONS)[number];

const BANNED_KEYS = ['command', 'shell', 'path', 'file', 'token', 'credential', 'cwd'];

export function memberCanCallDeviceControl(isAdmin: boolean): boolean {
  return isAdmin;
}

export function assertRemoteAction(action: string): asserts action is RemoteAction {
  if (!(REMOTE_ACTIONS as readonly string[]).includes(action)) {
    throw new Error('refused');
  }
}

export type DeviceControlPresence = {
  id: string;
  name: string;
  lastSeen: string;
  remoteEnabled: boolean;
  revoked: boolean;
  paused: boolean;
  paired: boolean;
  activeSessions: number;
  state?: string;
  sessions?: unknown;
};

/**
 * Admin `/device-control/devices` during migration: Hub ids (commands still
 * go to Hub) plus API kind `ide` rows so the page is not Hub-only.
 */
export function mergeDeviceControlPresence(
  hubRows: DeviceControlPresence[],
  apiRows: DeviceControlPresence[],
): DeviceControlPresence[] {
  const byId = new Map(apiRows.map((row) => [row.id, row]));
  const out: DeviceControlPresence[] = hubRows.map((row) => {
    const api = byId.get(row.id);
    if (!api) return row;
    return {
      ...row,
      lastSeen: api.lastSeen || row.lastSeen,
      remoteEnabled: api.remoteEnabled,
      revoked: api.revoked,
      paused: api.paused,
      paired: row.paired || api.paired,
    };
  });
  const seen = new Set(out.map((row) => row.id));
  for (const row of apiRows) {
    if (!seen.has(row.id)) out.push(row);
  }
  return out;
}

export function payloadAllowed(action: string, payload: Record<string, unknown> | undefined): boolean {
  const body = payload ?? {};
  const keys = Object.keys(body);
  if (keys.some((key) => BANNED_KEYS.includes(key))) return false;
  if (action === 'notify') {
    const message = body.message;
    return keys.length === 1 && typeof message === 'string' && message.trim().length > 0 && message.length <= 200;
  }
  if (action === 'open_ui') return keys.length === 0;
  if (action === 'pause_new_sessions') {
    if (keys.length === 0) return true;
    return keys.length === 1 && typeof body.paused === 'boolean';
  }
  if (action === 'request_cancel_session') {
    return keys.length === 1 && typeof body.session === 'string' && body.session.trim().length > 0;
  }
  return false;
}

if (require.main === module) {
  const checks: Array<[string, boolean]> = [
    ['admin may call', memberCanCallDeviceControl(true)],
    ['member may not call', memberCanCallDeviceControl(false) === false],
    ['notify allowed', payloadAllowed('notify', { message: 'hello' })],
    ['shell refused', payloadAllowed('notify', { message: 'hello', shell: 'cmd' }) === false],
    ['open_ui empty', payloadAllowed('open_ui', {})],
    ['cancel session', payloadAllowed('request_cancel_session', { session: 's1' })],
  ];
  const merged = mergeDeviceControlPresence(
    [
      {
        id: 'desk-1',
        name: 'hub',
        lastSeen: '2026-10-23T12:00:00Z',
        remoteEnabled: true,
        revoked: false,
        paused: false,
        paired: true,
        activeSessions: 1,
        sessions: [{ id: 's1', title: 'Fix' }],
      },
    ],
    [
      {
        id: 'desk-1',
        name: 'api',
        lastSeen: '2026-10-23T12:00:05Z',
        remoteEnabled: false,
        revoked: false,
        paused: true,
        paired: true,
        activeSessions: 0,
      },
      {
        id: 'desk-2',
        name: 'api-only',
        lastSeen: '2026-10-23T11:00:00Z',
        remoteEnabled: false,
        revoked: false,
        paused: false,
        paired: true,
        activeSessions: 0,
      },
    ],
  );
  checks.push(['merge overlays API presence', merged[0]?.paused === true]);
  checks.push(['merge keeps Hub sessions', Array.isArray(merged[0]?.sessions)]);
  checks.push(['merge appends API-only', merged.some((row) => row.id === 'desk-2')]);
  checks.push([
    'merge empty Hub lists API',
    mergeDeviceControlPresence([], [
      {
        id: 'desk-1',
        name: 'api',
        lastSeen: '',
        remoteEnabled: false,
        revoked: false,
        paused: false,
        paired: true,
        activeSessions: 0,
      },
    ]).length === 1,
  ]);
  let refused = false;
  try {
    assertRemoteAction('shell');
  } catch {
    refused = true;
  }
  checks.push(['shell action refused', refused]);
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(failed.map(([name]) => name).join(', '));
    process.exit(1);
  }
}
