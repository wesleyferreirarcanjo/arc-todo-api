import { normalizeNameKey, slugifyName } from './name-check.util';

export type AutocompleteStatus = 'established' | 'no_hit' | 'unknown';
export type OrganicStatus = 'crowded' | 'quiet' | 'unknown';
export type HistoryForOrganic =
  | 'history_found'
  | 'no_history_found'
  | 'unknown'
  | 'none';
export type HandlePlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'x';
export type HandleAvailability = 'available' | 'taken' | 'unknown';

export const HANDLE_PLATFORMS: readonly HandlePlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'x',
];

export type AutocompleteEvidence = {
  status: AutocompleteStatus;
  suggestions: string[];
  checkedAt: string;
};

export type OrganicCompetition = {
  status: OrganicStatus;
  autocomplete: AutocompleteEvidence;
  checkedAt: string;
};

export type HandleCheck = {
  platform: HandlePlatform;
  handle: string;
  profileUrl: string;
  availability: HandleAvailability;
  checkedAt: string;
};

export function extractAutocompleteSuggestions(body: unknown): string[] | null {
  if (!Array.isArray(body)) return null;
  if (body.length >= 2 && Array.isArray(body[1])) {
    return body[1]
      .map((item) => (typeof item === 'string' ? item : ''))
      .filter(Boolean);
  }
  const phrases = body
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'phrase' in item) {
        return String((item as { phrase?: unknown }).phrase ?? '');
      }
      return '';
    })
    .filter(Boolean);
  return phrases;
}

export function parseAutocompleteBody(
  body: unknown,
  query: string,
): { status: AutocompleteStatus; suggestions: string[] } {
  const suggestions = extractAutocompleteSuggestions(body);
  if (!suggestions || suggestions.length === 0) {
    return { status: 'unknown', suggestions: [] };
  }
  const queryKey = normalizeNameKey(query);
  if (!queryKey) {
    return { status: 'unknown', suggestions: [] };
  }
  const established = suggestions.some((item) =>
    suggestionShowsEstablishedMeaning(item, queryKey),
  );
  return {
    status: established ? 'established' : 'no_hit',
    suggestions: suggestions.slice(0, 8),
  };
}

export function suggestionShowsEstablishedMeaning(
  suggestion: string,
  queryKey: string,
): boolean {
  const key = normalizeNameKey(suggestion);
  if (!key.startsWith(queryKey)) return false;
  return key.slice(queryKey.length).trim().length > 0;
}

/**
 * Unresolved autocomplete or history never reads as quiet/clear (BR-NAME-03).
 * `historyStatus: 'none'` means no incumbent was in play (`.com` not taken).
 */
export function combineOrganicCompetition(input: {
  autocomplete: AutocompleteStatus;
  historyStatus: HistoryForOrganic;
}): OrganicStatus {
  const incumbent = input.historyStatus === 'history_found';
  if (input.autocomplete === 'established' || incumbent) {
    return 'crowded';
  }
  if (input.autocomplete === 'unknown' || input.historyStatus === 'unknown') {
    return 'unknown';
  }
  return 'quiet';
}

export function historyStatusForOrganic(
  comTaken: boolean,
  historyStatus: 'history_found' | 'no_history_found' | 'unknown' | undefined,
): HistoryForOrganic {
  if (!comTaken) return 'none';
  return historyStatus ?? 'unknown';
}

export function buildOrganicCompetition(
  autocomplete: AutocompleteEvidence,
  historyStatus: HistoryForOrganic,
  now = new Date().toISOString(),
): OrganicCompetition {
  return {
    status: combineOrganicCompetition({
      autocomplete: autocomplete.status,
      historyStatus,
    }),
    autocomplete,
    checkedAt: now,
  };
}

export function existingAutocomplete(value: unknown): AutocompleteEvidence {
  const record = value as OrganicCompetition | undefined;
  if (record?.autocomplete && typeof record.autocomplete.status === 'string') {
    return record.autocomplete;
  }
  return {
    status: 'unknown',
    suggestions: [],
    checkedAt: new Date().toISOString(),
  };
}

export function withoutWaveHandles<T extends { id: string }>(
  shortlistIds: string[] | undefined,
  candidate: T,
): T {
  if (Array.isArray(shortlistIds) && shortlistIds.includes(candidate.id)) {
    return candidate;
  }
  return { ...candidate, handleChecks: [] } as T;
}

export function handleSlug(name: string): string {
  return slugifyName(name).replace(/-/g, '').slice(0, 30);
}

export function handleProfileUrl(platform: HandlePlatform, handle: string): string {
  if (platform === 'instagram') return `https://www.instagram.com/${handle}/`;
  if (platform === 'facebook') return `https://www.facebook.com/${handle}`;
  if (platform === 'tiktok') return `https://www.tiktok.com/@${handle}`;
  if (platform === 'youtube') return `https://www.youtube.com/@${handle}`;
  return `https://x.com/${handle}`;
}

export function isGatedHandleRedirect(location: string | null | undefined): boolean {
  if (!location) return false;
  const lower = location.toLowerCase();
  return (
    lower.includes('login') ||
    lower.includes('checkpoint') ||
    lower.includes('/accounts/')
  );
}

/**
 * Map a handle probe HTTP outcome. Instagram and Facebook never resolve to
 * `available` from a server (gated/blocked → `unknown`). Timeouts, 401/403/429,
 * and gated redirects are `unknown`, never available (BR-NAME-03).
 */
export function handleProbeFromHttp(input: {
  platform: HandlePlatform;
  status: number | null;
  gated?: boolean;
}): HandleAvailability {
  const status = input.status;
  const blocked =
    input.gated ||
    status == null ||
    status === 401 ||
    status === 403 ||
    status === 429 ||
    status >= 500;
  if (blocked) {
    return 'unknown';
  }
  if (input.platform === 'instagram' || input.platform === 'facebook') {
    if (status === 200) return 'taken';
    return 'unknown';
  }
  if (status === 404) return 'available';
  if (status === 200) return 'taken';
  return 'unknown';
}

if (require.main === module) {
  const checks: Array<[string, boolean]> = [
    [
      'autocomplete empty is unknown',
      parseAutocompleteBody(['helios', []], 'Helios').status === 'unknown',
    ],
    [
      'autocomplete unparseable is unknown',
      parseAutocompleteBody({ error: true }, 'Helios').status === 'unknown',
    ],
    [
      'autocomplete failure never clear',
      (parseAutocompleteBody(null, 'Helios').status as string) !== 'clear' &&
        parseAutocompleteBody(null, 'Helios').status === 'unknown',
    ],
    [
      'autocomplete established extra tokens',
      parseAutocompleteBody(
        ['helios', ['helios greek god', 'helios energy']],
        'Helios',
      ).status === 'established',
    ],
    [
      'autocomplete phrase objects',
      parseAutocompleteBody([{ phrase: 'helios greek god' }], 'Helios')
        .status === 'established',
    ],
    [
      'autocomplete exact-only is no_hit',
      parseAutocompleteBody(['zorvex', ['zorvex']], 'Zorvex').status ===
        'no_hit',
    ],
    [
      'organic unknown+unknown never quiet',
      combineOrganicCompetition({
        autocomplete: 'unknown',
        historyStatus: 'unknown',
      }) === 'unknown',
    ],
    [
      'organic no_hit + unknown history never quiet',
      combineOrganicCompetition({
        autocomplete: 'no_hit',
        historyStatus: 'unknown',
      }) === 'unknown',
    ],
    [
      'organic established crowds even without history',
      combineOrganicCompetition({
        autocomplete: 'established',
        historyStatus: 'none',
      }) === 'crowded',
    ],
    [
      'organic incumbent crowds even if autocomplete unknown',
      combineOrganicCompetition({
        autocomplete: 'unknown',
        historyStatus: 'history_found',
      }) === 'crowded',
    ],
    [
      'organic quiet only when both resolved empty',
      combineOrganicCompetition({
        autocomplete: 'no_hit',
        historyStatus: 'none',
      }) === 'quiet',
    ],
    [
      'history none when com free',
      historyStatusForOrganic(false, 'unknown') === 'none',
    ],
    [
      'history unknown when com taken and missing',
      historyStatusForOrganic(true, undefined) === 'unknown',
    ],
    [
      'handle 403 is unknown not available',
      handleProbeFromHttp({ platform: 'youtube', status: 403 }) === 'unknown',
    ],
    [
      'handle timeout is unknown',
      handleProbeFromHttp({ platform: 'tiktok', status: null }) === 'unknown',
    ],
    [
      'handle instagram 404 never available',
      handleProbeFromHttp({ platform: 'instagram', status: 404 }) === 'unknown',
    ],
    [
      'handle facebook gated never available',
      handleProbeFromHttp({
        platform: 'facebook',
        status: 302,
        gated: true,
      }) === 'unknown',
    ],
    [
      'handle youtube 404 available',
      handleProbeFromHttp({ platform: 'youtube', status: 404 }) === 'available',
    ],
    [
      'handle youtube 200 taken',
      handleProbeFromHttp({ platform: 'youtube', status: 200 }) === 'taken',
    ],
    [
      'gated login redirect',
      isGatedHandleRedirect('https://www.instagram.com/accounts/login/') ===
        true,
    ],
    [
      'handle slug strips hyphens',
      handleSlug('Nova Pulse') === 'novapulse',
    ],
    [
      'wave strips handles unless shortlisted',
      withoutWaveHandles(['kept'], {
        id: 'wave',
        handleChecks: [{ platform: 'x' }],
      }).handleChecks.length === 0 &&
        withoutWaveHandles(['kept'], {
          id: 'kept',
          handleChecks: [{ platform: 'x' }],
        }).handleChecks.length === 1,
    ],
    [
      'no clear/available organic status',
      !(['clear', 'available'] as string[]).includes(
        combineOrganicCompetition({
          autocomplete: 'unknown',
          historyStatus: 'unknown',
        }),
      ),
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'name-organic.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`name-organic.util ok (${checks.length})`);
}
