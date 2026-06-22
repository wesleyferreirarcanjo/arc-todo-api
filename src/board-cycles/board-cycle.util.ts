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

export function getNextWeekBounds(closedEndDate: string): WeekBounds {
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
  const week = getWeekBounds(new Date('2026-06-22T15:00:00.000Z'));
  console.assert(
    week.startDate === '2026-06-22' && week.endDate === '2026-06-28',
    'expected Monday-Sunday week bounds',
  );

  const nextWeek = getNextWeekBounds('2026-06-28');
  console.assert(
    nextWeek.startDate === '2026-06-29' && nextWeek.endDate === '2026-07-05',
    'expected next week to follow closed end date',
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
