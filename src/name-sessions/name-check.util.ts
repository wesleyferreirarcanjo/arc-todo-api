export const NAME_TLDS = ['com', 'app', 'dev', 'io', 'xyz'] as const;
export type NameTld = (typeof NAME_TLDS)[number];

export type Availability = 'available' | 'taken' | 'unknown';
export type CandidateSource = 'human' | 'chatbot' | 'mcp';
export type CandidateStatus =
  | 'active'
  | 'rejected'
  | 'recommended'
  | 'runner_up';

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
