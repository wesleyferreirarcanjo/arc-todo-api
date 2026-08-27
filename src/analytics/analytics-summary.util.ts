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

export type AnalyticsTrendCountField =
  | 'tasksCreated'
  | 'tasksCompleted'
  | 'moves'
  | 'bugReports';

export interface AnalyticsTrendBucket {
  date: string;
  tasksCreated: number;
  tasksCompleted: number;
  moves: number;
  bugReports: number;
}

export interface ArchiveClosure {
  taskId: string;
  archivedAtMs: number;
  completedAtMs: number;
  createdById: string | null;
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

export function timestampMs(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return new Date(value).getTime();
  }
  return Number.NaN;
}

export function appendArchiveClosures(
  events: StatusChangeEvent[],
  archives: ArchiveClosure[],
): StatusChangeEvent[] {
  if (archives.length === 0) {
    return events;
  }
  const extra: StatusChangeEvent[] = [];
  const grouped = groupSorted(events);
  for (const archive of archives) {
    if (!Number.isFinite(archive.archivedAtMs)) {
      continue;
    }
    const list = grouped.get(archive.taskId) ?? [];
    const last = list.length > 0 ? list[list.length - 1] : undefined;
    const createdById = last?.createdById ?? archive.createdById;
    if (!last || last.status !== TaskStatus.DONE) {
      const enterMs = Number.isFinite(archive.completedAtMs)
        ? archive.completedAtMs
        : archive.archivedAtMs;
      if ((!last || enterMs > last.atMs) && enterMs <= archive.archivedAtMs) {
        extra.push({
          taskId: archive.taskId,
          atMs: enterMs,
          status: TaskStatus.DONE,
          createdById,
        });
      }
    }
    if (!last || archive.archivedAtMs > last.atMs) {
      extra.push({
        taskId: archive.taskId,
        atMs: archive.archivedAtMs,
        status: TaskStatus.DONE,
        createdById,
      });
    }
  }
  return extra.length === 0 ? events : [...events, ...extra];
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

export interface LastInteractionUser {
  userId: string;
  username: string;
}

export interface LastInteractionEvent {
  userId: string;
  lastInteractedAt: string;
  action: string;
  summary: string;
}

export interface AnalyticsLastInteractionRow {
  userId: string;
  username: string;
  lastInteractedAt: string | null;
  action: string | null;
  summary: string | null;
  tasksLast24h: number;
  checklistLast24h: number;
  bugsLast24h: number;
  tasksLast7d: number;
  checklistLast7d: number;
  bugsLast7d: number;
}

export const EMPTY_RECENT_WORK = {
  tasksLast24h: 0,
  checklistLast24h: 0,
  bugsLast24h: 0,
  tasksLast7d: 0,
  checklistLast7d: 0,
  bugsLast7d: 0,
} as const;

export interface RecentWorkCounts {
  tasksLast24h: number;
  checklistLast24h: number;
  bugsLast24h: number;
  tasksLast7d: number;
  checklistLast7d: number;
  bugsLast7d: number;
}

export interface RecentWorkEvent {
  userId: string;
  atMs: number;
  action: string;
  entityId: string | null;
  checkedCount?: number;
  metadata?: unknown;
  summary?: string | null;
}

export interface RecentBugFlagEvent {
  userId: string;
  atMs: number;
}

const TASK_WORK_ACTIONS = new Set([
  'task.created',
  'task.updated',
  'task.status_changed',
  'task.deleted',
  'task.checklist_checked',
]);

const CHECKED_SUMMARY = /Checked (\d+) checklist/i;

function asMetadata(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function positiveInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.trunc(n);
}

export function checklistItemsFromActivity(event: {
  action: string;
  checkedCount?: unknown;
  metadata?: unknown;
  summary?: string | null;
}): number {
  const metadata = asMetadata(event.metadata);
  const fromSummary = event.summary ? Number(event.summary.match(CHECKED_SUMMARY)?.[1]) : 0;
  const added = metadata.checkedAdded;
  return Math.max(
    positiveInt(event.checkedCount),
    positiveInt(metadata.checkedCount),
    Array.isArray(added) ? added.length : 0,
    positiveInt(fromSummary),
    event.action === 'task.checklist_checked' ? 1 : 0,
  );
}

export function countRecentWork(
  events: RecentWorkEvent[],
  nowMs: number,
  bugFlags: RecentBugFlagEvent[] = [],
): Map<string, RecentWorkCounts> {
  const last24hMs = nowMs - DAY_MS;
  const last7dMs = nowMs - 7 * DAY_MS;
  const tasks24h = new Map<string, Set<string>>();
  const tasks7d = new Map<string, Set<string>>();
  const checklist24h = new Map<string, number>();
  const checklist7d = new Map<string, number>();
  const bugs24h = new Map<string, number>();
  const bugs7d = new Map<string, number>();

  function taskSet(store: Map<string, Set<string>>, userId: string): Set<string> {
    const existing = store.get(userId);
    if (existing) {
      return existing;
    }
    const created = new Set<string>();
    store.set(userId, created);
    return created;
  }

  for (const event of events) {
    if (!TASK_WORK_ACTIONS.has(event.action) || event.atMs < last7dMs || event.atMs >= nowMs) {
      continue;
    }
    if (event.entityId) {
      taskSet(tasks7d, event.userId).add(event.entityId);
      if (event.atMs >= last24hMs) {
        taskSet(tasks24h, event.userId).add(event.entityId);
      }
    }
    if (event.action === 'task.checklist_checked') {
      const added = checklistItemsFromActivity(event);
      checklist7d.set(event.userId, (checklist7d.get(event.userId) ?? 0) + added);
      if (event.atMs >= last24hMs) {
        checklist24h.set(event.userId, (checklist24h.get(event.userId) ?? 0) + added);
      }
    }
  }

  for (const flag of bugFlags) {
    if (!flag.userId || flag.atMs < last7dMs || flag.atMs >= nowMs) {
      continue;
    }
    bugs7d.set(flag.userId, (bugs7d.get(flag.userId) ?? 0) + 1);
    if (flag.atMs >= last24hMs) {
      bugs24h.set(flag.userId, (bugs24h.get(flag.userId) ?? 0) + 1);
    }
  }

  const ids = new Set<string>([
    ...tasks24h.keys(),
    ...tasks7d.keys(),
    ...checklist24h.keys(),
    ...checklist7d.keys(),
    ...bugs24h.keys(),
    ...bugs7d.keys(),
  ]);
  const result = new Map<string, RecentWorkCounts>();
  for (const userId of ids) {
    result.set(userId, {
      tasksLast24h: tasks24h.get(userId)?.size ?? 0,
      checklistLast24h: checklist24h.get(userId) ?? 0,
      bugsLast24h: bugs24h.get(userId) ?? 0,
      tasksLast7d: tasks7d.get(userId)?.size ?? 0,
      checklistLast7d: checklist7d.get(userId) ?? 0,
      bugsLast7d: bugs7d.get(userId) ?? 0,
    });
  }
  return result;
}

export function mergeLastInteractions(
  users: LastInteractionUser[],
  events: LastInteractionEvent[],
  recentWork: Map<string, RecentWorkCounts> = new Map(),
): AnalyticsLastInteractionRow[] {
  const usernameById = new Map(users.map((user) => [user.userId, user.username]));
  const eventByUser = new Map(events.map((event) => [event.userId, event]));
  const ids = new Set<string>();
  for (const user of users) {
    ids.add(user.userId);
  }
  for (const event of events) {
    ids.add(event.userId);
    if (!usernameById.has(event.userId)) {
      usernameById.set(event.userId, event.userId);
    }
  }
  for (const userId of recentWork.keys()) {
    ids.add(userId);
    if (!usernameById.has(userId)) {
      usernameById.set(userId, userId);
    }
  }

  const rows = [...ids].map((userId) => {
    const event = eventByUser.get(userId);
    const work = recentWork.get(userId) ?? EMPTY_RECENT_WORK;
    return {
      userId,
      username: usernameById.get(userId) ?? userId,
      lastInteractedAt: event?.lastInteractedAt ?? null,
      action: event?.action ?? null,
      summary: event?.summary ?? null,
      tasksLast24h: work.tasksLast24h,
      checklistLast24h: work.checklistLast24h,
      bugsLast24h: work.bugsLast24h,
      tasksLast7d: work.tasksLast7d,
      checklistLast7d: work.checklistLast7d,
      bugsLast7d: work.bugsLast7d,
    };
  });

  rows.sort((left, right) => {
    if (left.lastInteractedAt === right.lastInteractedAt) {
      return left.username.localeCompare(right.username);
    }
    if (left.lastInteractedAt === null) {
      return 1;
    }
    if (right.lastInteractedAt === null) {
      return -1;
    }
    return right.lastInteractedAt.localeCompare(left.lastInteractedAt);
  });
  return rows;
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
  return { date, tasksCreated: 0, tasksCompleted: 0, moves: 0, bugReports: 0 };
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
  field: AnalyticsTrendCountField,
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
  field: AnalyticsTrendCountField,
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
  completed: Array<{ atMs: number }> = [],
): AnalyticsTrendBucket[] {
  const extra = [...created, ...moves, ...bugReports, ...completed].map((event) =>
    formatIsoDateUtc(event.atMs),
  );
  const buckets = emptyTrendBuckets(window, granularity, extra, nowMs);
  countEventsIntoTrend(buckets, created, 'tasksCreated', granularity);
  countEventsIntoTrend(buckets, completed, 'tasksCompleted', granularity);
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
    Date.now(),
    [{ atMs: Date.UTC(2026, 7, 26, 16) }],
  );
  console.assert(series.length === 3, 'three daily buckets');
  console.assert(series[0].date === '2026-08-24' && series[0].tasksCreated === 1 && series[0].bugReports === 1, 'first day counts');
  console.assert(series[1].moves === 1 && series[1].tasksCreated === 0, 'second day moves');
  console.assert(series[2].tasksCreated === 1 && series[2].tasksCompleted === 1, 'third day created and completed');

  const openDone = closedTestDwells([
    { taskId: 't1', atMs: 0, status: TaskStatus.QA_TEST, createdById: 'u1' },
    { taskId: 't1', atMs: 4_000, status: TaskStatus.DONE, createdById: 'u1' },
  ]);
  console.assert((openDone.byStatus.done.length ?? 0) === 0, 'open Done stay is omitted before archive');

  const afterSprintClose = closedTestDwells(
    appendArchiveClosures(
      [
        { taskId: 't1', atMs: 0, status: TaskStatus.QA_TEST, createdById: 'u1' },
        { taskId: 't1', atMs: 4_000, status: TaskStatus.DONE, createdById: 'u1' },
      ],
      [{ taskId: 't1', archivedAtMs: 10_000, completedAtMs: 4_000, createdById: 'u1' }],
    ),
  );
  console.assert(afterSprintClose.byStatus.done.length === 1, 'sprint close counts the Done stay');
  console.assert(afterSprintClose.byStatus.done[0] === 6_000, 'Done stay ends at archival');
  console.assert(afterSprintClose.qaTest[0] === 4_000, 'QA stay still closes at Done');

  const archivedWithoutMoves = closedTestDwells(
    appendArchiveClosures([], [
      { taskId: 't2', archivedAtMs: 8_000, completedAtMs: 3_000, createdById: 'u2' },
    ]),
  );
  console.assert(archivedWithoutMoves.byStatus.done[0] === 5_000, 'archived Done without status events still counts');
  console.assert(timestampMs('2026-08-25T12:00:00.000Z') === Date.parse('2026-08-25T12:00:00.000Z'), 'iso timestamp');

  const last = mergeLastInteractions(
    [
      { userId: 'u1', username: 'wesley' },
      { userId: 'u2', username: 'arthura' },
    ],
    [
      {
        userId: 'u1',
        lastInteractedAt: '2026-08-20T12:00:00.000Z',
        action: 'task.created',
        summary: 'Created task "Old"',
      },
      {
        userId: 'u3',
        lastInteractedAt: '2026-08-27T09:00:00.000Z',
        action: 'task.status_changed',
        summary: 'Moved task "New"',
      },
    ],
  );
  console.assert(last.length === 3, 'members plus leftover actors');
  console.assert(last[0].userId === 'u3' && last[0].username === 'u3', 'most recent first');
  console.assert(last[1].userId === 'u1' && last[1].summary === 'Created task "Old"', 'older activity next');
  console.assert(last[2].userId === 'u2' && last[2].lastInteractedAt === null, 'never-active last');
  console.assert(
    last[2].tasksLast24h === 0 && last[2].checklistLast7d === 0 && last[2].bugsLast7d === 0,
    'missing work is zero',
  );

  const now = Date.UTC(2026, 7, 27, 12);
  const recent = countRecentWork(
    [
      {
        userId: 'u1',
        atMs: now - 2 * 60 * 60 * 1000,
        action: 'task.status_changed',
        entityId: 't1',
        checkedCount: 0,
      },
      {
        userId: 'u1',
        atMs: now - 3 * 60 * 60 * 1000,
        action: 'task.checklist_checked',
        entityId: 't1',
        checkedCount: 2,
      },
      {
        userId: 'u1',
        atMs: now - 3 * DAY_MS,
        action: 'task.created',
        entityId: 't2',
        checkedCount: 0,
      },
      {
        userId: 'u1',
        atMs: now - 3 * DAY_MS,
        action: 'task.checklist_checked',
        entityId: 't2',
        checkedCount: 4,
      },
      {
        userId: 'u1',
        atMs: now - 8 * DAY_MS,
        action: 'task.created',
        entityId: 't3',
        checkedCount: 0,
      },
      {
        userId: 'u1',
        atMs: now - 90 * 60 * 1000,
        action: 'task.checklist_checked',
        entityId: 't4',
        summary: 'Checked 3 checklist items on task "QA"',
      },
      {
        userId: 'u1',
        atMs: now - 2 * DAY_MS,
        action: 'task.checklist_checked',
        entityId: 't5',
        metadata: { checkedAdded: ['item-1', 'item-2'] },
      },
    ],
    now,
    [
      { userId: 'u1', atMs: now - 60 * 60 * 1000 },
      { userId: 'u1', atMs: now - 2 * DAY_MS },
      { userId: 'u1', atMs: now - 8 * DAY_MS },
    ],
  );
  const wesleyWork = recent.get('u1');
  console.assert(wesleyWork?.tasksLast24h === 2, '24h unique tasks include checklist cards');
  console.assert(wesleyWork?.checklistLast24h === 5, '24h checklist uses count, summary, and default');
  console.assert(wesleyWork?.bugsLast24h === 1, '24h bug flags');
  console.assert(wesleyWork?.tasksLast7d === 4, '7d unique tasks include 24h');
  console.assert(wesleyWork?.checklistLast7d === 11, '7d checklist includes metadata arrays');
  console.assert(wesleyWork?.bugsLast7d === 2, '7d bug flags include 24h');

  console.assert(checklistItemsFromActivity({ action: 'task.updated' }) === 0, 'non-check is zero');
  console.assert(
    checklistItemsFromActivity({ action: 'task.checklist_checked' }) === 1,
    'checklist action without count is one',
  );
  console.assert(
    checklistItemsFromActivity({
      action: 'task.checklist_checked',
      metadata: '{"checkedCount":4}',
    }) === 4,
    'json metadata string',
  );
}
