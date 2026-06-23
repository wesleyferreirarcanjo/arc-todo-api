export const BUILTIN_TASK_CATEGORIES = [
  'coding',
  'meeting',
  'design',
  'marketing',
  'other',
] as const;

export type TaskCategory = (typeof BUILTIN_TASK_CATEGORIES)[number];

export const DEFAULT_TASK_CATEGORY: TaskCategory = 'other';

export function isTaskCategory(value: string): value is TaskCategory {
  return (BUILTIN_TASK_CATEGORIES as readonly string[]).includes(value);
}
