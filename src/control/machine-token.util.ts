import { randomBytes } from 'crypto';
import {
  pkceChallenge,
  pkceMatches,
  sha256Hex,
  statesMatch,
} from '../auth/desktop-auth.util';

/**
 * Machine credentials for the Windows "Connect this machine" flow.
 * Same one-time-hashed-token pattern as the cloud `act_` agent tokens
 * (BR-CLD-02), with a different prefix so a leaked value is identifiable.
 */
export const MACHINE_TOKEN_PREFIX = 'amt_';
export const MACHINE_CONNECT_CALLBACK = 'arc-windows://connect/callback';
export const CONNECT_CODE_TTL_MS = 10 * 60 * 1000;
export const SESSION_IDLE_MS = 10 * 60 * 1000;
/** Same presence window as BR-CLD-09. */
export const ONLINE_WINDOW_MS = 60 * 1000;
export const CLOSE_REASONS = ['release', 'idle', 'revoke', 'pause'] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export type MachineAuthVerdict = 'ok' | 'revoked' | 'mismatch';
export type MachineStatus = 'online' | 'paused' | 'offline';
export type ControlOpenVerdict =
  | 'ok'
  | 'denied'
  | 'revoked'
  | 'disabled'
  | 'paused';

export type MachineAuthRow = {
  tokenHash: string;
  revokedAt: Date | null;
};

export type MachineGateRow = {
  ownerUserId: string;
  revokedAt: Date | null;
  remoteEnabled: boolean;
  paused: boolean;
};

export function mintMachineToken(): string {
  return `${MACHINE_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function hashMachineToken(token: string): string {
  return sha256Hex(token);
}

/**
 * Authenticate a presented plaintext token against a stored hash.
 * A revoked machine answers 'revoked' immediately — there is no grace period.
 */
export function inspectMachineAuth(
  row: MachineAuthRow | null,
  presentedHash: string,
): MachineAuthVerdict {
  if (!row || !safeEqual(row.tokenHash, presentedHash)) return 'mismatch';
  if (row.revokedAt != null) return 'revoked';
  return 'ok';
}

/**
 * List status. Revocation is reported separately via `revoked_at`; this only
 * maps paused / last-seen presence.
 */
export function machineStatus(
  row: { paused: boolean; lastSeenAt: Date | null },
  now: number,
): MachineStatus {
  if (row.paused) return 'paused';
  if (row.lastSeenAt && now - row.lastSeenAt.getTime() <= ONLINE_WINDOW_MS) {
    return 'online';
  }
  return 'offline';
}

/**
 * The control gate: only the owner may open a control session — the
 * `is_admin` bypass (BR-ACL-01) deliberately does not apply here. Revoked,
 * remote-disabled, and paused machines refuse immediately.
 */
export function controlOpenVerdict(
  machine: MachineGateRow,
  callerUserId: string,
): ControlOpenVerdict {
  if (machine.ownerUserId !== callerUserId) return 'denied';
  if (machine.revokedAt != null) return 'revoked';
  if (!machine.remoteEnabled) return 'disabled';
  if (machine.paused) return 'paused';
  return 'ok';
}

export function machineConnectCallbackUrl(code: string, state: string): string {
  const url = new URL(MACHINE_CONNECT_CALLBACK);
  url.searchParams.set('code', code);
  url.searchParams.set('state', state);
  return url.toString();
}

/** Postgres unique-violation (e.g. a second usage insert for one turn_id). */
export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; driverError?: { code?: string } })
    ?.code;
  const driverCode = (error as { driverError?: { code?: string } })
    ?.driverError?.code;
  return code === '23505' || driverCode === '23505';
}

const SECRET_KEY = /password|secret|token|credential|private|api.?key/i;
const NEVER_STORE_KEY = /text|typed|keystroke|screenshot|screen|image|clipboard/i;
const REDACTED = '[redacted]';

/**
 * Second line of defense after the relay's own redaction: secrets become
 * '[redacted]' and anything that could carry typed text or a screenshot is
 * dropped entirely (never persisted, not even redacted).
 */
export function sanitizeToolInputs(
  inputs: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!inputs || typeof inputs !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (NEVER_STORE_KEY.test(key)) continue;
    if (SECRET_KEY.test(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeToolInputs(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length || left.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function selfCheck(): void {
  const token = mintMachineToken();
  assert(token.startsWith(MACHINE_TOKEN_PREFIX), 'machine token prefix');
  assert(!token.startsWith('act_'), 'prefix must differ from cloud agents');
  const hash = hashMachineToken(token);
  const row: MachineAuthRow = { tokenHash: hash, revokedAt: null };
  assert(
    inspectMachineAuth(row, hash) === 'ok',
    'sha256(token) authenticates',
  );
  assert(
    inspectMachineAuth(row, hashMachineToken('amt_wrong')) === 'mismatch',
    'unknown token refused',
  );
  assert(
    inspectMachineAuth({ ...row, revokedAt: new Date() }, hash) === 'revoked',
    'revoked machine refused immediately — no grace period',
  );
  assert(inspectMachineAuth(null, hash) === 'mismatch', 'missing row refused');

  const owner: MachineGateRow = {
    ownerUserId: 'u-owner',
    revokedAt: null,
    remoteEnabled: true,
    paused: false,
  };
  assert(
    controlOpenVerdict(owner, 'u-owner') === 'ok',
    'owner may open control',
  );
  // An admin id here would still fail — the gate is owner-equality only.
  assert(
    controlOpenVerdict(owner, 'u-admin') === 'denied',
    'non-owner (even admin) denied',
  );
  assert(
    controlOpenVerdict({ ...owner, revokedAt: new Date() }, 'u-owner') ===
      'revoked',
    'revoked refuses open',
  );
  assert(
    controlOpenVerdict({ ...owner, remoteEnabled: false }, 'u-owner') ===
      'disabled',
    'remote off refuses open',
  );
  assert(
    controlOpenVerdict({ ...owner, paused: true }, 'u-owner') === 'paused',
    'paused refuses open',
  );

  const now = Date.now();
  assert(
    machineStatus({ paused: false, lastSeenAt: new Date(now - 10_000) }, now) ===
      'online',
    'seen 10s ago is online',
  );
  assert(
    machineStatus({ paused: false, lastSeenAt: new Date(now - 120_000) }, now) ===
      'offline',
    'seen 2m ago is offline',
  );
  assert(
    machineStatus({ paused: true, lastSeenAt: new Date(now) }, now) === 'paused',
    'paused beats online',
  );
  assert(
    machineStatus({ paused: false, lastSeenAt: null }, now) === 'offline',
    'never seen is offline',
  );

  const verifier = 'a'.repeat(48);
  assert(
    pkceMatches(verifier, pkceChallenge(verifier)),
    'machine connect reuses S256 PKCE',
  );
  const state = 'state-value-0123456789';
  const callback = machineConnectCallbackUrl('one-time-code', state);
  assert(
    callback.startsWith(MACHINE_CONNECT_CALLBACK),
    'fixed arc-windows callback',
  );
  assert(statesMatch(sha256Hex(state), state), 'state hash matches');

  assert(
    isUniqueViolation({ code: '23505' }),
    'second usage insert for one turn_id surfaces as duplicate → inserted=false',
  );
  assert(!isUniqueViolation(new Error('boom')), 'other errors not unique');

  const scrubbed = sanitizeToolInputs({
    app: 'notepad',
    password: 'hunter2',
    typed_text: 'secret text',
    screenshot: 'base64…',
    nested: { path: 'C:/x', auth_token: 'abc' },
  });
  assert(scrubbed?.app === 'notepad', 'safe field kept');
  assert(scrubbed?.password === REDACTED, 'secret redacted');
  assert(!('typed_text' in (scrubbed ?? {})), 'typed text never stored');
  assert(!('screenshot' in (scrubbed ?? {})), 'screenshot never stored');
  assert(
    (scrubbed?.nested as Record<string, unknown>)?.auth_token === REDACTED,
    'nested secret redacted',
  );
}

if (require.main === module) {
  selfCheck();
  console.log('control machines self-check passed');
}
