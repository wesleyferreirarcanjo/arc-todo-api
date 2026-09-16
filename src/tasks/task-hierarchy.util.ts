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
    computeSubtaskProgress([
      { status: TaskStatus.DONE },
      { status: TaskStatus.DONE },
    ]).done === 2,
    'progress counts every done subtask',
  );
}
