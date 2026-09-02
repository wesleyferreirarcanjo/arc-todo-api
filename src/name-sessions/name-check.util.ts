export const NAME_TLDS = ['com', 'com.br', 'app', 'dev', 'io', 'xyz'] as const;
export type NameTld = (typeof NAME_TLDS)[number];

export type Availability = 'available' | 'taken' | 'unknown';
export type IncumbencyGrade =
  | 'dormant'
  | 'lightly_active'
  | 'clearly_active'
  | 'unknown';
export type ParkingSignal = 'parked' | 'content' | 'unknown';
export type CandidateSource = 'human' | 'chatbot' | 'mcp';
export type CandidateStatus =
  | 'active'
  | 'rejected'
  | 'recommended'
  | 'runner_up';

/** ~2 years — recent enough to treat a .com owner as still active. */
const INCUMBENCY_RECENT_MS = 1000 * 60 * 60 * 24 * 730;

export const NAMING_GOALS = [
  'public_product',
  'company',
  'feature',
  'api',
  'internal_codename',
  'campaign',
] as const;
export type NamingGoal = (typeof NAMING_GOALS)[number];
export const DEFAULT_NAMING_GOAL: NamingGoal = 'public_product';

const DNS_AVAILABLE_CODES = new Set([
  'ENOTFOUND',
  'ENODATA',
  'NOTFOUND',
  'NODATA',
]);

export function slugifyName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  const ascii = trimmed.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const slug = ascii
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug.slice(0, 63);
}

export function normalizeNameKey(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase();
}

export function googleQueryUrl(name: string): string {
  const q = `"${name.trim()}"`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}&filter=0`;
}

export function googleAppQueryUrl(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name.trim()} app`)}&filter=0`;
}

export function googleImagesQueryUrl(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${name.trim()}"`)}&tbm=isch&filter=0`;
}

export function combineAvailability(
  dnsStatus: Availability,
  rdapStatus: Availability,
): Availability {
  if (dnsStatus === 'taken' || rdapStatus === 'taken') {
    return 'taken';
  }
  if (dnsStatus === 'available' && rdapStatus === 'available') {
    return 'available';
  }
  return 'unknown';
}

export function dnsErrorToAvailability(err: unknown): Availability {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
  if (DNS_AVAILABLE_CODES.has(code)) {
    return 'available';
  }
  return 'unknown';
}

export function countTakenEndings(
  checks: Array<{ availability?: string }>,
): number {
  return checks.filter((check) => check.availability === 'taken').length;
}

export function parseHistoryTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  if (/^\d{14}$/.test(value)) {
    const iso =
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` +
      `T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`;
    const parsed = Date.parse(iso);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isRecentHistoryTimestamp(
  value: string | null | undefined,
  now = Date.now(),
): boolean {
  const parsed = parseHistoryTimestamp(value);
  if (parsed == null) return false;
  return now - parsed <= INCUMBENCY_RECENT_MS;
}

/**
 * Grades how active the current `.com` owner appears. Never treats unresolved
 * Wayback/crt.sh/parking evidence as favorable (BR-NAME-02 / BR-NAME-03).
 * This is not a judgment of the owner's business health.
 */
export function gradeComIncumbency(input: {
  comAvailability: Availability | undefined;
  historyStatus: 'history_found' | 'no_history_found' | 'unknown';
  lastCapture: string | null;
  captureCount: number | null;
  ctLatest: string | null;
  ctCount: number | null;
  parking: ParkingSignal;
  now?: number;
}): IncumbencyGrade {
  if (input.comAvailability !== 'taken') {
    return 'unknown';
  }
  if (input.historyStatus === 'unknown' && input.parking === 'unknown') {
    return 'unknown';
  }
  const now = input.now ?? Date.now();
  const recentWayback = isRecentHistoryTimestamp(input.lastCapture, now);
  const recentCt = isRecentHistoryTimestamp(input.ctLatest, now);
  const recent = recentWayback || recentCt;
  const anyHistory =
    input.historyStatus === 'history_found' ||
    (input.captureCount ?? 0) > 0 ||
    (input.ctCount ?? 0) > 0;

  if (input.parking === 'parked' && !recent) {
    return 'dormant';
  }
  if (input.parking === 'content' && recent) {
    return 'clearly_active';
  }
  if (input.parking === 'content' || recent || anyHistory) {
    return 'lightly_active';
  }
  if (input.historyStatus === 'no_history_found' || input.parking === 'parked') {
    return 'dormant';
  }
  return 'unknown';
}

export function isNamingGoal(value: unknown): value is NamingGoal {
  return (
    typeof value === 'string' &&
    (NAMING_GOALS as readonly string[]).includes(value)
  );
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function parseNameList(text: string, cap = 8): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const cleaned = line
      .replace(/^\s*(?:[-*]|\d+[.)])\s*/, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+[—–-]\s+.*$/, '')
      .trim();
    if (!cleaned || cleaned.length > 40) continue;
    if (/^(here|sure|names|suggestions|family)/i.test(cleaned)) continue;
    const key = normalizeNameKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(cleaned.replace(/[.]$/, ''));
    if (names.length >= cap) break;
  }
  return names;
}

if (require.main === module) {
  const checks: Array<[string, boolean]> = [
    ['slug', slugifyName('Nova Pulse') === 'nova-pulse'],
    ['slug strip', slugifyName("O'Reilly") === 'oreilly'],
    ['key case', normalizeNameKey('ArcTodo') === normalizeNameKey('arctodo')],
    [
      'google',
      googleQueryUrl('Helios').includes('%22Helios%22') &&
        googleQueryUrl('Helios').includes('filter=0'),
    ],
    [
      'taken wins',
      combineAvailability('available', 'taken') === 'taken' &&
        combineAvailability('taken', 'unknown') === 'taken',
    ],
    [
      'error never available',
      dnsErrorToAvailability({ code: 'ETIMEOUT' }) === 'unknown' &&
        dnsErrorToAvailability({ code: 'ENOTFOUND' }) === 'available',
    ],
    [
      'both available',
      combineAvailability('available', 'available') === 'available',
    ],
    [
      'unknown mix',
      combineAvailability('available', 'unknown') === 'unknown',
    ],
    [
      'tld ladder',
      NAME_TLDS[0] === 'com' &&
        NAME_TLDS.includes('com.br') &&
        NAME_TLDS.length === 6,
    ],
    [
      'taken endings',
      countTakenEndings([
        { availability: 'taken' },
        { availability: 'available' },
        { availability: 'unknown' },
        { availability: 'taken' },
      ]) === 2,
    ],
    [
      'incumbency unresolved',
      gradeComIncumbency({
        comAvailability: 'taken',
        historyStatus: 'unknown',
        lastCapture: null,
        captureCount: null,
        ctLatest: null,
        ctCount: null,
        parking: 'unknown',
      }) === 'unknown',
    ],
    [
      'incumbency dormant parked',
      gradeComIncumbency({
        comAvailability: 'taken',
        historyStatus: 'no_history_found',
        lastCapture: null,
        captureCount: 0,
        ctLatest: null,
        ctCount: 0,
        parking: 'parked',
      }) === 'dormant',
    ],
    [
      'incumbency clearly active',
      gradeComIncumbency({
        comAvailability: 'taken',
        historyStatus: 'history_found',
        lastCapture: '20250101120000',
        captureCount: 8,
        ctLatest: '2025-06-01T00:00:00.000Z',
        ctCount: 12,
        parking: 'content',
        now: Date.parse('2025-09-01T00:00:00.000Z'),
      }) === 'clearly_active',
    ],
    [
      'incumbency available com',
      gradeComIncumbency({
        comAvailability: 'available',
        historyStatus: 'no_history_found',
        lastCapture: null,
        captureCount: 0,
        ctLatest: null,
        ctCount: 0,
        parking: 'unknown',
      }) === 'unknown',
    ],
    ['median odd', median([1, 5, 3]) === 3],
    ['median even', median([1, 2, 3, 4]) === 2.5],
    ['median empty', median([]) === null],
    [
      'parse list',
      parseNameList('- Helios\n- Nova\nHelios\n1. Lumina').join(',') ===
        'Helios,Nova,Lumina',
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'name-check.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`name-check.util ok (${checks.length})`);
}
