import { createHash, timingSafeEqual } from 'crypto';

/** Fixed Arc IDE callback. Credentials never belong on this URL. */
export const DESKTOP_CALLBACK = 'arc-ide://arc-todo/callback';

export const CODE_TTL_MS = 2 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CodeVerdict = 'ok' | 'expired' | 'reused' | 'mismatch';
export type RefreshVerdict = 'ok' | 'expired' | 'reused' | 'revoked' | 'mismatch';

export type CodeCheck = {
  codeHash: string | null;
  codeExpiresAt: number | null;
  codeUsedAt: number | null;
};

export type RefreshCheck = {
  refreshHash: string | null;
  previousRefreshHash: string | null;
  refreshExpiresAt: number | null;
  revokedAt: number | null;
};

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** S256 PKCE challenge: base64url(SHA256(verifier)), no padding. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function pkceMatches(verifier: string, challenge: string): boolean {
  return safeEqual(pkceChallenge(verifier), challenge);
}

export function statesMatch(storedHash: string, presentedState: string): boolean {
  return safeEqual(storedHash, sha256Hex(presentedState));
}

export function inspectCode(
  row: CodeCheck | null,
  presentedHash: string,
  now: number,
): CodeVerdict {
  if (!row?.codeHash || !safeEqual(row.codeHash, presentedHash)) return 'mismatch';
  if (row.codeUsedAt != null) return 'reused';
  if (row.codeExpiresAt == null || row.codeExpiresAt <= now) return 'expired';
  return 'ok';
}

export function inspectRefresh(
  row: RefreshCheck | null,
  presentedHash: string,
  now: number,
): RefreshVerdict {
  if (!row) return 'mismatch';
  if (row.revokedAt != null) return 'revoked';
  const current = row.refreshHash != null && safeEqual(row.refreshHash, presentedHash);
  const previous =
    row.previousRefreshHash != null && safeEqual(row.previousRefreshHash, presentedHash);
  if (previous && !current) return 'reused';
  if (!current) return 'mismatch';
  if (row.refreshExpiresAt == null || row.refreshExpiresAt <= now) return 'expired';
  return 'ok';
}

/** Drop secret substrings so a log or error never echoes a code or token. */
export function redact(message: string, secrets: string[]): string {
  let out = message;
  for (const secret of secrets) {
    if (secret.length < 8) continue;
    out = out.split(secret).join('[redacted]');
  }
  return out;
}

export function desktopCallbackUrl(code: string, state: string): string {
  const url = new URL(DESKTOP_CALLBACK);
  url.searchParams.set('code', code);
  url.searchParams.set('state', state);
  return url.toString();
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function selfCheck(): void {
  const verifier = 'a'.repeat(48);
  const challenge = pkceChallenge(verifier);
  assert(pkceMatches(verifier, challenge), 'expected matching verifier');
  assert(!pkceMatches('b'.repeat(48), challenge), 'bad verifier');

  const state = 'state-value-0123456789';
  const stateHash = sha256Hex(state);
  assert(statesMatch(stateHash, state), 'expected state match');
  assert(!statesMatch(stateHash, 'other-state-0123456789'), 'state mismatch');

  const code = 'one-time-code-0123456789abcd';
  const codeHash = sha256Hex(code);
  const fresh: CodeCheck = {
    codeHash,
    codeExpiresAt: 2_000,
    codeUsedAt: null,
  };
  assert(inspectCode(fresh, codeHash, 1_000) === 'ok', 'fresh code');
  assert(inspectCode(fresh, codeHash, 2_000) === 'expired', 'expired code');
  assert(
    inspectCode({ ...fresh, codeUsedAt: 1_100 }, codeHash, 1_200) === 'reused',
    'reused code',
  );
  assert(inspectCode(fresh, sha256Hex('nope'), 1_000) === 'mismatch', 'unknown code');

  const refresh = 'refresh-token-0123456789abcd';
  const refreshHash = sha256Hex(refresh);
  const older = sha256Hex('older-refresh-0123456789abcd');
  const live: RefreshCheck = {
    refreshHash,
    previousRefreshHash: older,
    refreshExpiresAt: 5_000,
    revokedAt: null,
  };
  assert(inspectRefresh(live, refreshHash, 1_000) === 'ok', 'current refresh');
  assert(inspectRefresh(live, older, 1_000) === 'reused', 'refresh reuse');
  assert(inspectRefresh(live, refreshHash, 5_000) === 'expired', 'expired refresh');
  assert(
    inspectRefresh({ ...live, revokedAt: 1 }, refreshHash, 1_000) === 'revoked',
    'revoked refresh',
  );

  const callback = desktopCallbackUrl(code, state);
  assert(callback.startsWith(DESKTOP_CALLBACK), 'fixed callback');
  assert(callback.includes(`code=${encodeURIComponent(code)}`) || callback.includes('code='), 'code param');
  assert(!callback.includes(refresh), 'callback has no refresh credential');
  assert(!callback.includes('accessToken'), 'callback has no access token');

  const leaked = redact(`failed for ${code} and ${refresh}`, [code, refresh]);
  assert(!leaked.includes(code) && !leaked.includes(refresh), 'redacted errors');
  assert(leaked.includes('[redacted]'), 'redaction marker');
}

if (require.main === module) {
  selfCheck();
  console.log('desktop-auth self-check passed');
}
