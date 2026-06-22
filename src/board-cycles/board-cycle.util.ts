import { TaskStatus } from '../tasks/task.enums';

export interface WeekBounds {
  startDate: string;
  endDate: string;
}

export interface ArchivalCandidate {
  id: string;
  status: TaskStatus;
  archivedInCycleId: string | null;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function atUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Seven-day cycles anchored to the project's start date (UTC). */
export function getProjectAnchoredCycleBounds(
  projectStartDate: Date,
  referenceDate: Date,
): WeekBounds {
  const anchor = atUtcMidnight(projectStartDate);
  const ref = atUtcMidnight(referenceDate);
  const msPerDay = 86400000;
  const daysSinceStart = Math.max(
    0,
    Math.floor((ref.getTime() - anchor.getTime()) / msPerDay),
  );
  const cycleIndex = Math.floor(daysSinceStart / 7);
  const start = new Date(anchor);
  start.setUTCDate(anchor.getUTCDate() + cycleIndex * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

export function getNextCycleBounds(closedEndDate: string): WeekBounds {
  const end = atUtcMidnight(new Date(`${closedEndDate}T00:00:00.000Z`));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() + 1);
  const nextEnd = new Date(start);
  nextEnd.setUTCDate(start.getUTCDate() + 6);
  return {
    startDate: toDateString(start),
    endDate: toDateString(nextEnd),
  };
}

/** @deprecated use getProjectAnchoredCycleBounds */
export function getWeekBounds(referenceDate: Date): WeekBounds {
  const base = atUtcMidnight(referenceDate);
  const day = base.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setUTCDate(base.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

/** @deprecated use getNextCycleBounds */
export function getNextWeekBounds(closedEndDate: string): WeekBounds {
  return getNextCycleBounds(closedEndDate);
}

export function isCyclePeriodEnded(
  endDate: string,
  referenceDate: Date = new Date(),
): boolean {
  const today = toDateString(atUtcMidnight(referenceDate));
  return compareDateStrings(today, endDate) > 0;
}

export function selectTasksForArchival<T extends ArchivalCandidate>(
  tasks: T[],
): T[] {
  return tasks.filter(
    (task) =>
      task.status === TaskStatus.DONE && task.archivedInCycleId === null,
  );
}

export function selectTasksRemainingActive<T extends ArchivalCandidate>(
  tasks: T[],
): T[] {
  return tasks.filter(
    (task) =>
      task.archivedInCycleId === null &&
      (task.status === TaskStatus.TODO || task.status === TaskStatus.IN_PROGRESS),
  );
}

if (require.main === module) {
  const projectStart = new Date('2026-06-05T15:00:00.000Z');
  const first = getProjectAnchoredCycleBounds(
    projectStart,
    new Date('2026-06-05T15:00:00.000Z'),
  );
  console.assert(
    first.startDate === '2026-06-05' && first.endDate === '2026-06-11',
    'expected first cycle to start on project creation date',
  );

  const thirdWeek = getProjectAnchoredCycleBounds(
    projectStart,
    new Date('2026-06-20T12:00:00.000Z'),
  );
  console.assert(
    thirdWeek.startDate === '2026-06-19' && thirdWeek.endDate === '2026-06-25',
    'expected anchored cycle index from project start',
  );

  const next = getNextCycleBounds('2026-06-11');
  console.assert(
    next.startDate === '2026-06-12' && next.endDate === '2026-06-18',
    'expected next cycle to follow closed end date',
  );

  console.assert(
    isCyclePeriodEnded('2026-06-11', new Date('2026-06-12T00:00:00.000Z')),
    'expected cycle to end after end date',
  );
  console.assert(
    !isCyclePeriodEnded('2026-06-11', new Date('2026-06-11T23:59:00.000Z')),
    'expected cycle to remain active on end date',
  );

  const tasks: ArchivalCandidate[] = [
    { id: '1', status: TaskStatus.DONE, archivedInCycleId: null },
    { id: '2', status: TaskStatus.DONE, archivedInCycleId: 'cycle-a' },
    { id: '3', status: TaskStatus.TODO, archivedInCycleId: null },
    { id: '4', status: TaskStatus.IN_PROGRESS, archivedInCycleId: null },
  ];

  const archival = selectTasksForArchival(tasks);
  console.assert(
    archival.length === 1 && archival[0].id === '1',
    'expected only unarchived done tasks',
  );

  const active = selectTasksRemainingActive(tasks);
  console.assert(
    active.length === 2 &&
      active.every(
        (task) =>
          task.status === TaskStatus.TODO ||
          task.status === TaskStatus.IN_PROGRESS,
      ),
    'expected open work to remain active',
  );
}
