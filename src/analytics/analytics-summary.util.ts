import { TaskStatus } from '../tasks/task.enums';

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
}
