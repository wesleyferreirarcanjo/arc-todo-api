import { timingSafeEqual } from 'crypto';

export const DEVICE_KINDS = ['browser', 'windows', 'ide'] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

export const CONSENT_MODES = ['always', 'ask', 'off'] as const;
export type ConsentMode = (typeof CONSENT_MODES)[number];

export const DEVICE_CLOSE_REASONS = [
  'release',
  'idle',
  'revoke',
  'pause',
] as const;
export type DeviceCloseReason = (typeof DEVICE_CLOSE_REASONS)[number];

/**
 * Idle is per-kind until Wesley unifies (parent #arc-629 open question).
 * Browser 15 min (BR-BRW-06); Windows 10 min (existing SESSION_IDLE_MS).
 * IDE hosts use the Windows 10 min window — not a new BR.
 */
export const BROWSER_IDLE_MS = 15 * 60 * 1000;
export const WINDOWS_IDLE_MS = 10 * 60 * 1000;
export const IDE_IDLE_MS = WINDOWS_IDLE_MS;

export const DEVICE_INTERNAL_TOKEN_ENVS = [
  'ARC_CONTROL_INTERNAL_TOKEN',
  'ARC_BROWSER_INTERNAL_TOKEN',
  'ARC_HUB_INTERNAL_TOKEN',
] as const;
export const MIN_INTERNAL_TOKEN_LENGTH = 32;

/** BR-WIN-01: remote control stays off until the owner flips it. */
export const WINDOWS_REMOTE_ENABLED_DEFAULT = false;

/**
 * Tray Take over and MCP `release_session` close the shared API session
 * with this reason. DesktopUnavailable handling in the relay is #arc-624.
 */
export const TAKEOVER_CLOSE_REASON: DeviceCloseReason = 'release';

export type ControlOpenVerdict =
  | 'ok'
  | 'denied'
  | 'revoked'
  | 'disabled'
  | 'paused';

export type DeviceDetailAccess = 'ok' | 'missing';

export type MachineGateRow = {
  ownerUserId: string;
  revokedAt: Date | null;
  remoteEnabled: boolean;
  paused: boolean;
  kind?: DeviceKind;
  consentMode?: ConsentMode;
};

export type SessionOpenPlan =
  | { insert: true }
  | { insert: false; error: 'not_found' | ControlOpenVerdict };

export function isDeviceKind(value: string): value is DeviceKind {
  return (DEVICE_KINDS as readonly string[]).includes(value);
}

export function isConsentMode(value: string): value is ConsentMode {
  return (CONSENT_MODES as readonly string[]).includes(value);
}

export function idleMsForKind(kind: DeviceKind): number {
  if (kind === 'browser') return BROWSER_IDLE_MS;
  return WINDOWS_IDLE_MS;
}

/**
 * Owner-only detail (BR-ACL-20): a non-owner — including an admin — sees
 * the same 'missing' as a row that does not exist. No existence leak.
 */
export function deviceDetailAccess(
  device: { ownerUserId: string } | null,
  callerUserId: string,
): DeviceDetailAccess {
  if (!device || device.ownerUserId !== callerUserId) return 'missing';
  return 'ok';
}

/**
 * Admin may list every device; everyone else lists only their own
 * (BR-ACL-21 list half). Detail and control stay owner-equality.
 */
export function deviceListScope(isAdmin: boolean): 'all' | 'own' {
  return isAdmin ? 'all' : 'own';
}

/**
 * Owner or admin may revoke; anyone else gets the same 'missing' as a
 * hole in the table (BR-ACL-21 revoke half).
 */
export function deviceRevokeAccess(
  device: { ownerUserId: string } | null,
  callerUserId: string,
  isAdmin: boolean,
): DeviceDetailAccess {
  if (!device) return 'missing';
  if (device.ownerUserId === callerUserId || isAdmin) return 'ok';
  return 'missing';
}

export function isWindowsKind(
  kind: DeviceKind | string | undefined | null,
): boolean {
  return kind === 'windows';
}

/**
 * GET /machines where-clause: Windows rows only. Members see their own;
 * admins see every Windows PC for the revoke UI (BR-ACL-20 / BR-ACL-21).
 * Browser and IDE rows stay off this surface.
 */
export function windowsListWhere(
  isAdmin: boolean,
  userId: string,
): { kind: 'windows' } | { kind: 'windows'; ownerUserId: string } {
  if (deviceListScope(isAdmin) === 'all') return { kind: 'windows' };
  return { kind: 'windows', ownerUserId: userId };
}

type WindowsSurfaceRow = { ownerUserId: string; kind?: DeviceKind };

/** `/machines/:id` detail/PATCH/sessions/tool-calls: non-windows looks missing. */
export function windowsSurfaceAccess(
  device: WindowsSurfaceRow | null,
  callerUserId: string,
): DeviceDetailAccess {
  if (!device || !isWindowsKind(device.kind)) return 'missing';
  return deviceDetailAccess(device, callerUserId);
}

/** `/machines/:id/revoke`: owner or admin, Windows rows only. */
export function windowsRevokeAccess(
  device: WindowsSurfaceRow | null,
  callerUserId: string,
  isAdmin: boolean,
): DeviceDetailAccess {
  if (!device || !isWindowsKind(device.kind)) return 'missing';
  return deviceRevokeAccess(device, callerUserId, isAdmin);
}

/**
 * Control gate for every kind (BR-ACL-21): only the owner may open a
 * session. The `is_admin` bypass (BR-ACL-01) does not apply. Kind-specific
 * extra gates: Windows uses remoteEnabled/paused; browser refuses consent
 * `off`; IDE is owner + not revoked.
 */
export function controlOpenVerdict(
  machine: MachineGateRow,
  callerUserId: string,
): ControlOpenVerdict {
  if (machine.ownerUserId !== callerUserId) return 'denied';
  if (machine.revokedAt != null) return 'revoked';
  const kind = machine.kind ?? 'windows';
  if (kind === 'windows') {
    if (!machine.remoteEnabled) return 'disabled';
    if (machine.paused) return 'paused';
    return 'ok';
  }
  if (kind === 'browser') {
    if (machine.consentMode === 'off') return 'disabled';
    return 'ok';
  }
  return 'ok';
}

/**
 * Insert gate for session open. Callers must not write a session row when
 * `insert` is false — that is the admin-cannot-control check.
 */
export function sessionOpenPlan(
  device: MachineGateRow | null,
  callerUserId: string,
): SessionOpenPlan {
  if (!device) return { insert: false, error: 'not_found' };
  const verdict = controlOpenVerdict(device, callerUserId);
  if (verdict !== 'ok') return { insert: false, error: verdict };
  return { insert: true };
}

export function collectInternalTokens(
  env: Record<string, string | undefined>,
): string[] {
  const out: string[] = [];
  for (const key of DEVICE_INTERNAL_TOKEN_ENVS) {
    const value = env[key] ?? '';
    if (value.length >= MIN_INTERNAL_TOKEN_LENGTH) out.push(value);
  }
  return out;
}

export function presentedInternalTokenMatches(
  presented: string,
  expected: readonly string[],
): boolean {
  if (!presented || expected.length === 0) return false;
  const presentedBuf = Buffer.from(presented);
  let matched = false;
  for (const token of expected) {
    const buf = Buffer.from(token);
    if (
      presentedBuf.length === buf.length &&
      timingSafeEqual(presentedBuf, buf)
    ) {
      matched = true;
    }
  }
  return matched;
}

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function windowsOwner(): MachineGateRow {
  return {
    ownerUserId: 'u-owner',
    revokedAt: null,
    remoteEnabled: true,
    paused: false,
    kind: 'windows',
    consentMode: 'ask',
  };
}

function selfCheck(): void {
  const ownerPc = windowsOwner();
  const missing: DeviceDetailAccess = 'missing';

  // ACL tests first (BR-ACL-20 / BR-ACL-21).
  assert(
    deviceDetailAccess(null, 'u-other') === missing,
    'missing row is missing',
  );
  assert(
    deviceDetailAccess(ownerPc, 'u-other') === missing,
    'non-owner GET detail is indistinguishable from missing (404)',
  );
  assert(
    deviceDetailAccess(ownerPc, 'u-admin') === missing,
    'admin GET detail of someone else is missing (404), not 200',
  );
  assert(
    deviceDetailAccess(ownerPc, 'u-owner') === 'ok',
    'owner GET detail is ok',
  );

  const adminOpen = sessionOpenPlan(ownerPc, 'u-admin');
  assert(adminOpen.insert === false, 'admin control-open must not insert a session row');
  assert(
    !adminOpen.insert && adminOpen.error === 'denied',
    'admin control-open is denied (403), not a session row',
  );
  const otherOpen = sessionOpenPlan(ownerPc, 'u-other');
  assert(otherOpen.insert === false, 'non-owner control-open must not insert');
  const missingOpen = sessionOpenPlan(null, 'u-admin');
  assert(
    missingOpen.insert === false && missingOpen.error === 'not_found',
    'open on a missing device is not_found and does not insert',
  );
  const ownerOpen = sessionOpenPlan(ownerPc, 'u-owner');
  assert(ownerOpen.insert === true, 'owner control-open may insert');

  assert(deviceListScope(true) === 'all', 'admin lists every device');
  assert(deviceListScope(false) === 'own', 'member lists own devices');
  assert(
    deviceRevokeAccess(ownerPc, 'u-admin', true) === 'ok',
    'admin may revoke',
  );
  assert(
    deviceRevokeAccess(ownerPc, 'u-other', false) === missing,
    'non-owner non-admin revoke looks missing',
  );

  assert(
    controlOpenVerdict(ownerPc, 'u-owner') === 'ok',
    'windows owner may open',
  );
  assert(
    controlOpenVerdict(ownerPc, 'u-admin') === 'denied',
    'windows admin denied',
  );
  assert(
    controlOpenVerdict({ ...ownerPc, remoteEnabled: false }, 'u-owner') ===
      'disabled',
    'windows remote off refuses',
  );
  assert(
    controlOpenVerdict({ ...ownerPc, paused: true }, 'u-owner') === 'paused',
    'windows paused refuses',
  );

  const browser: MachineGateRow = {
    ownerUserId: 'u-owner',
    revokedAt: null,
    remoteEnabled: false,
    paused: false,
    kind: 'browser',
    consentMode: 'ask',
  };
  assert(
    controlOpenVerdict(browser, 'u-owner') === 'ok',
    'browser ask/always may open (relay still gates Ask)',
  );
  assert(
    controlOpenVerdict(browser, 'u-admin') === 'denied',
    'browser admin denied — BR-ACL-21 applies to all kinds',
  );
  assert(
    sessionOpenPlan(browser, 'u-admin').insert === false,
    'browser admin open inserts no session row',
  );
  assert(
    controlOpenVerdict({ ...browser, consentMode: 'off' }, 'u-owner') ===
      'disabled',
    'browser consent off refuses open',
  );
  assert(
    deviceDetailAccess(browser, 'u-admin') === missing,
    'browser admin GET detail is missing',
  );

  const ide: MachineGateRow = {
    ownerUserId: 'u-owner',
    revokedAt: null,
    remoteEnabled: false,
    paused: false,
    kind: 'ide',
    consentMode: 'ask',
  };
  assert(controlOpenVerdict(ide, 'u-owner') === 'ok', 'ide owner may open');
  assert(controlOpenVerdict(ide, 'u-admin') === 'denied', 'ide admin denied');
  assert(
    sessionOpenPlan(ide, 'u-admin').insert === false,
    'ide admin open inserts no session row',
  );
  assert(
    controlOpenVerdict({ ...ide, revokedAt: new Date() }, 'u-owner') ===
      'revoked',
    'ide revoked refuses',
  );

  assert(idleMsForKind('browser') === BROWSER_IDLE_MS, 'browser idle 15 min');
  assert(idleMsForKind('windows') === WINDOWS_IDLE_MS, 'windows idle 10 min');
  assert(idleMsForKind('ide') === IDE_IDLE_MS, 'ide idle matches windows');
  assert(BROWSER_IDLE_MS !== WINDOWS_IDLE_MS, 'idle stays per-kind');

  const tokens = collectInternalTokens({
    ARC_CONTROL_INTERNAL_TOKEN: 'c'.repeat(32),
    ARC_BROWSER_INTERNAL_TOKEN: 'b'.repeat(32),
    ARC_HUB_INTERNAL_TOKEN: 'short',
  });
  assert(tokens.length === 2, 'short hub token ignored');
  assert(
    presentedInternalTokenMatches('b'.repeat(32), tokens),
    'browser relay token accepted',
  );
  assert(
    presentedInternalTokenMatches('c'.repeat(32), tokens),
    'control relay token accepted',
  );
  assert(
    !presentedInternalTokenMatches('nope', tokens),
    'user JWT / wrong token refused',
  );
  assert(
    collectInternalTokens({}).length === 0,
    'no tokens → unconfigured',
  );

  // Windows alias (#arc-639): GET /machines is kind=windows only.
  assert(isWindowsKind('windows'), 'windows kind is on GET /machines');
  assert(!isWindowsKind('browser'), 'browser is not on GET /machines');
  assert(!isWindowsKind('ide'), 'ide is not on GET /machines');
  const memberWhere = windowsListWhere(false, 'u-owner');
  assert(memberWhere.kind === 'windows', 'member list is windows-only');
  assert(
    'ownerUserId' in memberWhere && memberWhere.ownerUserId === 'u-owner',
    'member lists own PCs only (BR-ACL-20)',
  );
  const adminWhere = windowsListWhere(true, 'u-admin');
  assert(adminWhere.kind === 'windows', 'admin list is still windows-only');
  assert(
    !('ownerUserId' in adminWhere),
    'admin lists every Windows PC for revoke, not other kinds',
  );

  const browserPc: WindowsSurfaceRow = {
    ownerUserId: 'u-owner',
    kind: 'browser',
  };
  assert(
    windowsSurfaceAccess(browserPc, 'u-owner') === missing,
    'owner PATCH /machines/:id on a browser UUID is missing',
  );
  assert(
    windowsRevokeAccess(browserPc, 'u-admin', true) === missing,
    'admin cannot revoke a browser via /machines',
  );
  assert(
    windowsSurfaceAccess(ownerPc, 'u-admin') === missing,
    'admin cannot see someone else tool-calls (BR-ACL-21)',
  );
  assert(
    windowsRevokeAccess(ownerPc, 'u-admin', true) === 'ok',
    'admin may revoke a Windows PC',
  );
  assert(
    windowsRevokeAccess(ownerPc, 'u-owner', false) === 'ok',
    'owner may revoke their PC',
  );
  assert(
    WINDOWS_REMOTE_ENABLED_DEFAULT === false,
    'BR-WIN-01 remoteEnabled defaults false',
  );
  assert(
    TAKEOVER_CLOSE_REASON === 'release',
    'Take over / release_session closes the shared API session with reason release',
  );
  assert(
    (DEVICE_CLOSE_REASONS as readonly string[]).includes(TAKEOVER_CLOSE_REASON),
    'Take over close reason lives in the shared session model, not a second store',
  );
}

if (require.main === module) {
  selfCheck();
  console.log('device acl self-check passed');
}
