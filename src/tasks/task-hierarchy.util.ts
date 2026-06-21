import { TaskStatus } from './task.enums';

export interface SubtaskProgress {
  total: number;
  done: number;
}

export function computeSubtaskProgress(
  subtasks: Array<{ status: TaskStatus }>,
): SubtaskProgress {
  return {
    total: subtasks.length,
    done: subtasks.filter((task) => task.status === TaskStatus.DONE).length,
  };
}

export function shouldCompleteParent(
  subtasks: Array<{ status: TaskStatus }>,
): boolean {
  return (
    subtasks.length > 0 &&
    subtasks.every((task) => task.status === TaskStatus.DONE)
  );
}

export function shouldReopenParent(
  previousStatus: TaskStatus,
  nextStatus: TaskStatus,
): boolean {
  return (
    previousStatus === TaskStatus.DONE && nextStatus !== TaskStatus.DONE
  );
}

if (require.main === module) {
  const subtasks = [
    { status: TaskStatus.DONE },
    { status: TaskStatus.TODO },
  ];

  console.assert(
    computeSubtaskProgress(subtasks).done === 1,
    'expected one done subtask',
  );
  console.assert(
    !shouldCompleteParent(subtasks),
    'parent should not complete with open subtask',
  );
  console.assert(
    shouldCompleteParent([
      { status: TaskStatus.DONE },
      { status: TaskStatus.DONE },
    ]),
    'parent should complete when all subtasks done',
  );
  console.assert(
    shouldReopenParent(TaskStatus.DONE, TaskStatus.IN_PROGRESS),
    'parent should reopen when subtask reopens',
  );
  console.assert(
    !shouldReopenParent(TaskStatus.TODO, TaskStatus.DONE),
    'no reopen when subtask was not done before',
  );
}
