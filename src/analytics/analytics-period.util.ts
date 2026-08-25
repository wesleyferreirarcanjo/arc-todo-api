export const ANALYTICS_PERIODS = ['7d', '30d', '90d', 'all', 'custom'] as const;
export type AnalyticsPeriodKey = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_COMPARE_MODES = ['previous', 'custom'] as const;
export type AnalyticsCompareMode = (typeof ANALYTICS_COMPARE_MODES)[number];

export const ANALYTICS_DEFAULT_PERIOD: AnalyticsPeriodKey = '30d';

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PRESET_DAYS: Record<Exclude<AnalyticsPeriodKey, 'all' | 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export interface TimeWindow {
  startMs: number | null;
  endMs: number | null;
}

export interface ResolvedAnalyticsPeriod {
  key: AnalyticsPeriodKey;
  label: string;
  current: TimeWindow;
  previous: TimeWindow | null;
  previousLabel: string | null;
  fromDate: string | null;
  toDate: string | null;
  compareFromDate: string | null;
  compareToDate: string | null;
}

export interface AnalyticsPeriodQuery {
  period?: string;
  from?: string;
  to?: string;
  compareMode?: string;
  compareFrom?: string;
  compareTo?: string;
}

export type PeriodResolveResult =
  | { ok: true; value: ResolvedAnalyticsPeriod }
  | { ok: false; reason: 'invalid-range' };

export interface GrowthMetric {
  current: number;
  previous: number | null;
  delta: number | null;
  percent: number | null;
}

export function isAnalyticsPeriodKey(value: string | undefined): value is AnalyticsPeriodKey {
  return ANALYTICS_PERIODS.includes(value as AnalyticsPeriodKey);
}

export function isAnalyticsCompareMode(value: string | undefined): value is AnalyticsCompareMode {
  return ANALYTICS_COMPARE_MODES.includes(value as AnalyticsCompareMode);
}

export function utcDayStartMs(iso: string): number | null {
  if (!ISO_DATE.test(iso)) {
    return null;
  }
  const [year, month, day] = iso.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

export function utcDayEndExclusiveMs(iso: string): number | null {
  const start = utcDayStartMs(iso);
  return start === null ? null : start + DAY_MS;
}

export function formatIsoDateUtc(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDateUtc(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function inRange(atMs: number, window: TimeWindow): boolean {
  if (window.startMs !== null && atMs < window.startMs) {
    return false;
  }
  if (window.endMs !== null && atMs >= window.endMs) {
    return false;
  }
  return true;
}

export function growthMetric(current: number, previous: number | null): GrowthMetric {
  if (previous === null) {
    return { current, previous: null, delta: null, percent: null };
  }
  const delta = current - previous;
  const percent =
    previous === 0 ? (current === 0 ? 0 : null) : Math.round((delta / previous) * 100);
  return { current, previous, delta, percent };
}

function inclusiveDateWindow(from: string, to: string): TimeWindow | null {
  const startMs = utcDayStartMs(from);
  const endMs = utcDayEndExclusiveMs(to);
  if (startMs === null || endMs === null || startMs >= endMs) {
    return null;
  }
  return { startMs, endMs };
}

function windowDates(window: TimeWindow): { fromDate: string | null; toDate: string | null } {
  if (window.startMs === null || window.endMs === null) {
    return { fromDate: null, toDate: null };
  }
  return {
    fromDate: formatIsoDateUtc(window.startMs),
    toDate: formatIsoDateUtc(window.endMs - 1),
  };
}

function rangeLabel(window: TimeWindow): string {
  const dates = windowDates(window);
  if (!dates.fromDate || !dates.toDate || window.startMs === null || window.endMs === null) {
    return 'All time';
  }
  const startLabel = formatDisplayDateUtc(window.startMs);
  const endLabel = formatDisplayDateUtc(window.endMs - 1);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}

function previousEqualWindow(current: TimeWindow): TimeWindow | null {
  if (current.startMs === null || current.endMs === null) {
    return null;
  }
  const duration = current.endMs - current.startMs;
  return {
    startMs: current.startMs - duration,
    endMs: current.startMs,
  };
}

export function resolveAnalyticsPeriod(
  query: AnalyticsPeriodQuery,
  nowMs = Date.now(),
): PeriodResolveResult {
  const key = isAnalyticsPeriodKey(query.period) ? query.period : ANALYTICS_DEFAULT_PERIOD;
  const compareMode: AnalyticsCompareMode = isAnalyticsCompareMode(query.compareMode)
    ? query.compareMode
    : 'previous';

  let current: TimeWindow;
  let label: string;

  if (key === 'all') {
    current = { startMs: null, endMs: null };
    label = 'All time';
  } else if (key === 'custom') {
    if (!query.from || !query.to) {
      return { ok: false, reason: 'invalid-range' };
    }
    const window = inclusiveDateWindow(query.from, query.to);
    if (!window) {
      return { ok: false, reason: 'invalid-range' };
    }
    current = window;
    label = rangeLabel(window);
  } else {
    const days = PRESET_DAYS[key];
    current = {
      startMs: nowMs - days * DAY_MS,
      endMs: nowMs,
    };
    label = key === '7d' ? 'Last 7 days' : key === '30d' ? 'Last 30 days' : 'Last 90 days';
  }

  let previous: TimeWindow | null = null;
  let previousLabel: string | null = null;
  let compareFromDate: string | null = null;
  let compareToDate: string | null = null;

  if (key !== 'all' && compareMode === 'custom') {
    if (!query.compareFrom || !query.compareTo) {
      return { ok: false, reason: 'invalid-range' };
    }
    const compareWindow = inclusiveDateWindow(query.compareFrom, query.compareTo);
    if (!compareWindow) {
      return { ok: false, reason: 'invalid-range' };
    }
    previous = compareWindow;
    previousLabel = rangeLabel(compareWindow);
    const dates = windowDates(compareWindow);
    compareFromDate = dates.fromDate;
    compareToDate = dates.toDate;
  } else if (key !== 'all') {
    previous = previousEqualWindow(current);
    if (previous) {
      previousLabel = `Previous period (${rangeLabel(previous)})`;
      const dates = windowDates(previous);
      compareFromDate = dates.fromDate;
      compareToDate = dates.toDate;
    }
  }

  const currentDates = windowDates(current);
  return {
    ok: true,
    value: {
      key,
      label,
      current,
      previous,
      previousLabel,
      fromDate: currentDates.fromDate,
      toDate: currentDates.toDate,
      compareFromDate,
      compareToDate,
    },
  };
}

if (require.main === module) {
  const frozen = Date.UTC(2026, 7, 25, 12, 0, 0);

  const thirty = resolveAnalyticsPeriod({ period: '30d' }, frozen);
  console.assert(thirty.ok, '30d resolves');
  if (thirty.ok) {
    console.assert(thirty.value.label === 'Last 30 days', '30d label');
    console.assert(thirty.value.previous !== null, '30d has previous');
    console.assert(
      thirty.value.previous !== null &&
        thirty.value.current.startMs === thirty.value.previous.endMs,
      'previous ends where current starts',
    );
  }

  const all = resolveAnalyticsPeriod({ period: 'all', compareMode: 'custom', compareFrom: '2026-07-01', compareTo: '2026-07-31' }, frozen);
  console.assert(all.ok && all.value.previous === null, 'all time has no previous');

  const custom = resolveAnalyticsPeriod(
    { period: 'custom', from: '2026-08-01', to: '2026-08-10' },
    frozen,
  );
  console.assert(custom.ok, 'custom range resolves');
  if (custom.ok) {
    console.assert(custom.value.fromDate === '2026-08-01', 'custom from');
    console.assert(custom.value.toDate === '2026-08-10', 'custom to');
    console.assert(custom.value.current.endMs === Date.UTC(2026, 7, 11), 'exclusive end');
  }

  const inverted = resolveAnalyticsPeriod(
    { period: 'custom', from: '2026-08-10', to: '2026-08-01' },
    frozen,
  );
  console.assert(!inverted.ok, 'inverted custom is invalid');

  const missing = resolveAnalyticsPeriod({ period: 'custom' }, frozen);
  console.assert(!missing.ok, 'custom without dates is invalid');

  const compare = resolveAnalyticsPeriod(
    {
      period: '7d',
      compareMode: 'custom',
      compareFrom: '2026-07-01',
      compareTo: '2026-07-07',
    },
    frozen,
  );
  console.assert(compare.ok && compare.value.previousLabel?.includes('1 Jul 2026'), 'custom compare label');

  console.assert(inRange(frozen, { startMs: frozen, endMs: frozen + 1 }), 'inclusive start');
  console.assert(!inRange(frozen, { startMs: null, endMs: frozen }), 'exclusive end');
  console.assert(inRange(frozen, { startMs: null, endMs: null }), 'all-time window');

  const grown = growthMetric(15, 10);
  console.assert(grown.delta === 5 && grown.percent === 50, 'growth percent');
  const emptyPrev = growthMetric(4, null);
  console.assert(emptyPrev.delta === null && emptyPrev.percent === null, 'null previous');
  const fromZero = growthMetric(3, 0);
  console.assert(fromZero.delta === 3 && fromZero.percent === null, 'percent null when previous is 0');
}
