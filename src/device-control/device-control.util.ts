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
