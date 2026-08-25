import { TaskStatus } from '../tasks/task.enums';
import type { AnalyticsPeriodKey } from './analytics-period.util';
import type { TimeWindow } from './analytics-period.util';
import { formatIsoDateUtc } from './analytics-period.util';

export const ANALYTICS_COMPLETION_TIMESTAMP_SOURCE = 'task.updatedAt';
export const ANALYTICS_TEST_DURATION_SOURCE = 'user_activity.task.status_changed';

export const EMPTY_BY_STATUS: Record<TaskStatus, number> = {
  [TaskStatus.TODO]: 0,
  [TaskStatus.IN_PROGRESS]: 0,
  [TaskStatus.DEV_TEST]: 0,
  [TaskStatus.QA_TEST]: 0,
  [TaskStatus.DONE]: 0,
};

export interface MeanResult {
  averageMs: number | null;
  sampleSize: number;
}

export interface StatusChangeEvent {
  taskId: string;
  atMs: number;
  status: string;
  createdById: string | null;
}

export interface BugHistoryEvent {
  taskId: string;
  atMs: number;
  newValue: string | null;
}

export interface ClosedTestDwells {
  byStatus: Record<TaskStatus, number[]>;
  devTest: number[];
  qaTest: number[];
  byCreator: Map<string | null, { devTest: number[]; qaTest: number[] }>;
}

export interface ClosedDwell {
  status: TaskStatus;
  startMs: number;
  endMs: number;
  durationMs: number;
  createdById: string | null;
}

export type AnalyticsTrendGranularity = 'day' | 'week';

export interface AnalyticsTrendBucket {
  date: string;
  tasksCreated: number;
  moves: number;
  bugReports: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function emptyByStatus(): Record<TaskStatus, number[]> {
  return {
    [TaskStatus.TODO]: [],
    [TaskStatus.IN_PROGRESS]: [],
    [TaskStatus.DEV_TEST]: [],
    [TaskStatus.QA_TEST]: [],
    [TaskStatus.DONE]: [],
  };
}

function isTaskStatus(value: string): value is TaskStatus {
  return (Object.values(TaskStatus) as string[]).includes(value);
}

export function meanMs(values: number[]): MeanResult {
  if (values.length === 0) {
    return { averageMs: null, sampleSize: 0 };
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return { averageMs: Math.round(sum / values.length), sampleSize: values.length };
}

function groupSorted<T extends { taskId: string; atMs: number }>(
  events: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const event of events) {
    const list = grouped.get(event.taskId) ?? [];
    list.push(event);
    grouped.set(event.taskId, list);
  }
  for (const list of grouped.values()) {
    list.sort((left, right) => left.atMs - right.atMs);
  }
  return grouped;
}

function creatorBucket(
  byCreator: Map<string | null, { devTest: number[]; qaTest: number[] }>,
  createdById: string | null,
): { devTest: number[]; qaTest: number[] } {
  const existing = byCreator.get(createdById);
  if (existing) {
    return existing;
  }
  const created = { devTest: [], qaTest: [] };
  byCreator.set(createdById, created);
  return created;
}

export function closedStatusDwells(events: StatusChangeEvent[]): ClosedDwell[] {
  const dwells: ClosedDwell[] = [];
  for (const list of groupSorted(events).values()) {
    for (let index = 0; index < list.length - 1; index += 1) {
      const current = list[index];
      const next = list[index + 1];
      const duration = next.atMs - current.atMs;
      if (duration < 0 || !isTaskStatus(current.status)) {
        continue;
      }
      dwells.push({
        status: current.status,
        startMs: current.atMs,
        endMs: next.atMs,
        durationMs: duration,
        createdById: current.createdById,
      });
    }
  }
  return dwells;
}

export function closedTestDwells(
  events: StatusChangeEvent[],
  include?: (dwell: ClosedDwell) => boolean,
): ClosedTestDwells {
  const byCreator = new Map<string | null, { devTest: number[]; qaTest: number[] }>();
  const byStatus = emptyByStatus();

  for (const dwell of closedStatusDwells(events)) {
    if (include && !include(dwell)) {
      continue;
    }
    byStatus[dwell.status].push(dwell.durationMs);
    const bucket = creatorBucket(byCreator, dwell.createdById);
    if (dwell.status === TaskStatus.DEV_TEST) {
      bucket.devTest.push(dwell.durationMs);
    } else if (dwell.status === TaskStatus.QA_TEST) {
      bucket.qaTest.push(dwell.durationMs);
    }
  }

  return {
    byStatus,
    devTest: byStatus[TaskStatus.DEV_TEST],
    qaTest: byStatus[TaskStatus.QA_TEST],
    byCreator,
  };
}

export function closedBugSolves(events: BugHistoryEvent[]): {
  reports: number;
  solves: Array<{ durationMs: number; reportedAtMs: number; resolvedAtMs: number }>;
} {
  let reports = 0;
  const solves: Array<{ durationMs: number; reportedAtMs: number; resolvedAtMs: number }> = [];

  for (const list of groupSorted(events).values()) {
    let openAt: number | null = null;
    for (const event of list) {
      if (event.newValue === 'true') {
        reports += 1;
        openAt = event.atMs;
      } else if (event.newValue === 'false' && openAt !== null) {
        const duration = event.atMs - openAt;
        if (duration >= 0) {
          solves.push({
            durationMs: duration,
            reportedAtMs: openAt,
            resolvedAtMs: event.atMs,
          });
        }
        openAt = null;
      }
    }
  }

  return { reports, solves };
}

export function closedBugSolveMs(events: BugHistoryEvent[]): {
  durations: number[];
  reports: number;
} {
  const { reports, solves } = closedBugSolves(events);
  return { durations: solves.map((solve) => solve.durationMs), reports };
}

export function mergePersonIds(
  ...idLists: Array<Iterable<string | null | undefined>>
): Array<string | null> {
  const seen = new Set<string>();
  const result: Array<string | null> = [];
  for (const list of idLists) {
    for (const id of list) {
      const key = id ?? '';
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(id ?? null);
    }
  }
  return result;
}

export function analyticsTrendGranularity(
  key: AnalyticsPeriodKey,
  window: TimeWindow,
): AnalyticsTrendGranularity {
  if (key === '7d' || key === '30d') {
    return 'day';
  }
  if (key === '90d' || key === 'all') {
    return 'week';
  }
  if (window.startMs !== null && window.endMs !== null) {
    const days = (window.endMs - window.startMs) / DAY_MS;
    return days <= 45 ? 'day' : 'week';
  }
  return 'week';
}

export function utcDayStart(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function utcWeekStart(ms: number): number {
  const dayStart = utcDayStart(ms);
  const weekday = new Date(dayStart).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return dayStart + mondayOffset * DAY_MS;
}

export function bucketStartMs(atMs: number, granularity: AnalyticsTrendGranularity): number {
  return granularity === 'day' ? utcDayStart(atMs) : utcWeekStart(atMs);
}

function emptyBucket(date: string): AnalyticsTrendBucket {
  return { date, tasksCreated: 0, moves: 0, bugReports: 0 };
}

export function emptyTrendBuckets(
  window: TimeWindow,
  granularity: AnalyticsTrendGranularity,
  extraDates: string[] = [],
  nowMs = Date.now(),
): AnalyticsTrendBucket[] {
  const step = granularity === 'day' ? DAY_MS : WEEK_MS;
  let startMs = window.startMs;
  const endMs = window.endMs ?? nowMs;
  if (startMs === null) {
    const fromExtra = extraDates
      .map((date) => {
        const [year, month, day] = date.split('-').map(Number);
        return Date.UTC(year, month - 1, day);
      })
      .filter((ms) => Number.isFinite(ms));
    startMs = fromExtra.length > 0 ? Math.min(...fromExtra) : endMs - 12 * WEEK_MS;
  }
  let cursor = bucketStartMs(startMs, granularity);
  const last = bucketStartMs(Math.max(endMs - 1, startMs), granularity);
  const buckets: AnalyticsTrendBucket[] = [];
  while (cursor <= last) {
    buckets.push(emptyBucket(formatIsoDateUtc(cursor)));
    cursor += step;
  }
  return buckets;
}

export function fillTrendField(
  buckets: AnalyticsTrendBucket[],
  rows: Array<{ date: string; count: number }>,
  field: 'tasksCreated' | 'moves' | 'bugReports',
): void {
  const index = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  for (const row of rows) {
    const bucket = index.get(row.date.slice(0, 10));
    if (bucket) {
      bucket[field] += row.count;
    }
  }
}

export function countEventsIntoTrend(
  buckets: AnalyticsTrendBucket[],
  events: Array<{ atMs: number }>,
  field: 'tasksCreated' | 'moves' | 'bugReports',
  granularity: AnalyticsTrendGranularity,
): void {
  const counts = new Map<string, number>();
  for (const event of events) {
    const date = formatIsoDateUtc(bucketStartMs(event.atMs, granularity));
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  fillTrendField(
    buckets,
    [...counts.entries()].map(([date, count]) => ({ date, count })),
    field,
  );
}

export function bucketSeries(
  created: Array<{ atMs: number }>,
  moves: Array<{ atMs: number }>,
  bugReports: Array<{ atMs: number }>,
  window: TimeWindow,
  granularity: AnalyticsTrendGranularity,
  nowMs = Date.now(),
): AnalyticsTrendBucket[] {
  const extra = [...created, ...moves, ...bugReports].map((event) =>
    formatIsoDateUtc(event.atMs),
  );
  const buckets = emptyTrendBuckets(window, granularity, extra, nowMs);
  countEventsIntoTrend(buckets, created, 'tasksCreated', granularity);
  countEventsIntoTrend(buckets, moves, 'moves', granularity);
  countEventsIntoTrend(buckets, bugReports, 'bugReports', granularity);
  return buckets;
}

if (require.main === module) {
  const empty = meanMs([]);
  console.assert(empty.averageMs === null && empty.sampleSize === 0, 'empty mean is null');

  const averaged = meanMs([1000, 3000]);
  console.assert(averaged.averageMs === 2000 && averaged.sampleSize === 2, 'mean of two values');

  const dwells = closedTestDwells([
    { taskId: 't1', atMs: 0, status: TaskStatus.DEV_TEST, createdById: 'u1' },
    { taskId: 't1', atMs: 4_000, status: TaskStatus.QA_TEST, createdById: 'u1' },
    { taskId: 't1', atMs: 10_000, status: TaskStatus.DONE, createdById: 'u1' },
    { taskId: 't2', atMs: 0, status: TaskStatus.QA_TEST, createdById: 'u2' },
  ]);
  console.assert(dwells.devTest.length === 1 && dwells.devTest[0] === 4_000, 'closed dev-test dwell');
  console.assert(dwells.qaTest.length === 1 && dwells.qaTest[0] === 6_000, 'closed qa-test dwell');
  console.assert(dwells.byStatus.dev_test[0] === 4_000, 'status-keyed dwell');
  console.assert(dwells.byCreator.get('u1')?.devTest[0] === 4_000, 'creator-keyed dwell');
  console.assert(
    (dwells.byCreator.get('u2')?.qaTest.length ?? 0) === 0,
    'open test dwell is omitted',
  );
  const endedEarly = closedTestDwells(
    [
      { taskId: 't1', atMs: 0, status: TaskStatus.DEV_TEST, createdById: 'u1' },
      { taskId: 't1', atMs: 4_000, status: TaskStatus.QA_TEST, createdById: 'u1' },
      { taskId: 't1', atMs: 10_000, status: TaskStatus.DONE, createdById: 'u1' },
    ],
    (dwell) => dwell.endMs < 5_000,
  );
  console.assert(endedEarly.devTest.length === 1 && endedEarly.qaTest.length === 0, 'dwell end filter');

  const bugs = closedBugSolveMs([
    { taskId: 't1', atMs: 0, newValue: 'true' },
    { taskId: 't1', atMs: 8_000, newValue: 'false' },
    { taskId: 't2', atMs: 1_000, newValue: 'true' },
  ]);
  console.assert(bugs.reports === 2, 'two bug reports');
  console.assert(bugs.durations.length === 1 && bugs.durations[0] === 8_000, 'one closed bug solve');

  const monday = Date.UTC(2026, 7, 24);
  console.assert(utcWeekStart(Date.UTC(2026, 7, 25)) === monday, 'week starts Monday UTC');
  console.assert(analyticsTrendGranularity('30d', { startMs: 0, endMs: 1 }) === 'day', '30d is daily');
  console.assert(analyticsTrendGranularity('90d', { startMs: 0, endMs: 1 }) === 'week', '90d is weekly');
  console.assert(
    analyticsTrendGranularity('custom', {
      startMs: Date.UTC(2026, 7, 1),
      endMs: Date.UTC(2026, 7, 10),
    }) === 'day',
    'short custom is daily',
  );

  const window = { startMs: Date.UTC(2026, 7, 24), endMs: Date.UTC(2026, 7, 27) };
  const series = bucketSeries(
    [{ atMs: Date.UTC(2026, 7, 24, 12) }, { atMs: Date.UTC(2026, 7, 26, 8) }],
    [{ atMs: Date.UTC(2026, 7, 25, 9) }],
    [{ atMs: Date.UTC(2026, 7, 24, 18) }],
    window,
    'day',
  );
  console.assert(series.length === 3, 'three daily buckets');
  console.assert(series[0].date === '2026-08-24' && series[0].tasksCreated === 1 && series[0].bugReports === 1, 'first day counts');
  console.assert(series[1].moves === 1 && series[1].tasksCreated === 0, 'second day moves');
  console.assert(series[2].tasksCreated === 1, 'third day created');
}
