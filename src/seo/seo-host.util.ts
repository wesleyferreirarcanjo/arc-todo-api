import { isIP, isIPv4 } from 'net';
import { lookup } from 'dns/promises';

export type HostParseOk = { ok: true; hostname: string };
export type HostParseFail = { ok: false; reason: 'invalid' | 'ssrf' };
export type HostParseResult = HostParseOk | HostParseFail;

const BLOCKED_HOSTS = new Set(['localhost', 'localhost.localdomain', '0.0.0.0']);

function inCidrV4(ip: string, base: string, bits: number): boolean {
  const ipNum = ipv4ToInt(ip);
  const baseNum = ipv4ToInt(base);
  if (ipNum === null || baseNum === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

function ipv4ToInt(ip: string): number | null {
  if (!isIPv4(ip)) return null;
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return null;
  }
  return (
    (((parts[0] << 24) >>> 0) +
      ((parts[1] << 16) >>> 0) +
      ((parts[2] << 8) >>> 0) +
      (parts[3] >>> 0)) >>>
    0
  );
}

function mappedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const prefixes = ['::ffff:', '::ffff:0:'];
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      const rest = ip.slice(prefix.length);
      if (isIPv4(rest)) return rest;
    }
  }
  return null;
}

export function isBlockedIpAddress(ip: string): boolean {
  const trimmed = ip.trim().replace(/^\[|\]$/g, '');
  const v4 = isIPv4(trimmed) ? trimmed : mappedIpv4(trimmed);
  if (v4) {
    return (
      inCidrV4(v4, '0.0.0.0', 8) ||
      inCidrV4(v4, '127.0.0.0', 8) ||
      inCidrV4(v4, '10.0.0.0', 8) ||
      inCidrV4(v4, '172.16.0.0', 12) ||
      inCidrV4(v4, '192.168.0.0', 16) ||
      inCidrV4(v4, '169.254.0.0', 16)
    );
  }
  if (isIP(trimmed) !== 6) return false;
  const lower = trimmed.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  const groups = expandIpv6(lower);
  if (!groups) return true;
  const first = parseInt(groups[0], 16);
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  return false;
}

function expandIpv6(ip: string): string[] | null {
  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  if (ip.includes('::')) {
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    return [
      ...headParts,
      ...Array.from({ length: missing }, () => '0'),
      ...tailParts,
    ];
  }
  const parts = ip.split(':');
  return parts.length === 8 ? parts : null;
}

function hostnameLooksLocal(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === 'metadata.google.internal') return true;
  return false;
}

export function parseSiteHostname(input: string): HostParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'invalid' };

  let candidate = trimmed.replace(/\/+$/, '');
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'ssrf' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'ssrf' };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostname.length > 253) {
    return { ok: false, reason: 'invalid' };
  }
  if (hostnameLooksLocal(hostname) || isBlockedIpAddress(hostname)) {
    return { ok: false, reason: 'ssrf' };
  }
  return { ok: true, hostname };
}

export function homepageUrl(hostname: string): string {
  return `https://${hostname}/`;
}

export function isSameHostname(url: string, hostname: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase() === hostname;
  } catch {
    return false;
  }
}

export function parseHttpUrl(url: string): HostParseResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'ssrf' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'ssrf' };
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) return { ok: false, reason: 'invalid' };
  if (hostnameLooksLocal(hostname) || isBlockedIpAddress(hostname)) {
    return { ok: false, reason: 'ssrf' };
  }
  return { ok: true, hostname };
}

export async function resolvePublicHostname(
  hostname: string,
): Promise<{ ok: true } | HostParseFail> {
  if (hostnameLooksLocal(hostname) || isBlockedIpAddress(hostname)) {
    return { ok: false, reason: 'ssrf' };
  }
  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!records.length) return { ok: false, reason: 'invalid' };
  if (records.some((record) => isBlockedIpAddress(record.address))) {
    return { ok: false, reason: 'ssrf' };
  }
  return { ok: true };
}

export async function assertPublicHttpUrl(
  url: string,
): Promise<{ ok: true; hostname: string } | HostParseFail> {
  const parsed = parseHttpUrl(url);
  if (!parsed.ok) return parsed;
  const resolved = await resolvePublicHostname(parsed.hostname);
  if (!resolved.ok) return resolved;
  return { ok: true, hostname: parsed.hostname };
}

if (require.main === module) {
  const checks: Array<[string, boolean]> = [
    [
      'https origin normalizes to hostname',
      parseSiteHostname('https://example.com/').ok === true &&
        (parseSiteHostname('https://example.com/') as HostParseOk).hostname ===
          'example.com',
    ],
    [
      'bare host normalizes',
      parseSiteHostname('example.com').ok === true &&
        (parseSiteHostname('example.com') as HostParseOk).hostname ===
          'example.com',
    ],
    [
      'trailing slash stripped',
      parseSiteHostname('https://Example.COM/path/').ok === true &&
        (parseSiteHostname('https://Example.COM/path/') as HostParseOk)
          .hostname === 'example.com',
    ],
    ['empty host invalid', parseSiteHostname('').ok === false && (parseSiteHostname('') as HostParseFail).reason === 'invalid'],
    ['whitespace invalid', parseSiteHostname('   ').ok === false && (parseSiteHostname('   ') as HostParseFail).reason === 'invalid'],
    ['ftp blocked', parseSiteHostname('ftp://example.com').ok === false && (parseSiteHostname('ftp://example.com') as HostParseFail).reason === 'ssrf'],
    [
      'credentials blocked',
      parseSiteHostname('https://user:pass@example.com').ok === false &&
        (parseSiteHostname('https://user:pass@example.com') as HostParseFail).reason === 'ssrf',
    ],
    ['loopback blocked', parseSiteHostname('127.0.0.1').ok === false && (parseSiteHostname('127.0.0.1') as HostParseFail).reason === 'ssrf'],
    ['ten-dot blocked', parseSiteHostname('10.1.2.3').ok === false && (parseSiteHostname('10.1.2.3') as HostParseFail).reason === 'ssrf'],
    [
      'rfc1918 172 blocked',
      parseSiteHostname('172.16.0.1').ok === false &&
        (parseSiteHostname('172.16.0.1') as HostParseFail).reason === 'ssrf',
    ],
    [
      'rfc1918 192 blocked',
      parseSiteHostname('192.168.1.1').ok === false &&
        (parseSiteHostname('192.168.1.1') as HostParseFail).reason === 'ssrf',
    ],
    [
      'link-local blocked',
      parseSiteHostname('169.254.169.254').ok === false &&
        (parseSiteHostname('169.254.169.254') as HostParseFail).reason === 'ssrf',
    ],
    ['localhost blocked', parseSiteHostname('localhost').ok === false && (parseSiteHostname('localhost') as HostParseFail).reason === 'ssrf'],
    [
      'ipv6 loopback blocked',
      parseSiteHostname('https://[::1]/').ok === false &&
        (parseSiteHostname('https://[::1]/') as HostParseFail).reason === 'ssrf',
    ],
    ['blocked ip helper loopback', isBlockedIpAddress('127.0.0.1')],
    ['blocked ip helper ula', isBlockedIpAddress('fc00::1')],
    ['blocked ip helper mapped', isBlockedIpAddress('::ffff:10.0.0.1')],
    ['public ip helper allows', isBlockedIpAddress('1.1.1.1') === false],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'seo-host.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`seo-host.util ok (${checks.length})`);
}
