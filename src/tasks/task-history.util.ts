import { TaskHistoryField } from './task-history-field.enum';

export interface TaskHistoryDraft {
  field: TaskHistoryField;
  oldValue: string | null;
  newValue: string | null;
}

function normalizeDescription(value: string | null | undefined): string {
  return value ?? '';
}

function formatDueDate(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

export function buildTaskHistoryDrafts(
  current: {
    title: string;
    description: string | null;
    dueDate: Date | null;
  },
  updates: {
    title?: string;
    description?: string;
    dueDate?: string | null;
  },
): TaskHistoryDraft[] {
  const drafts: TaskHistoryDraft[] = [];

  if (updates.title !== undefined && updates.title !== current.title) {
    drafts.push({
      field: TaskHistoryField.TITLE,
      oldValue: current.title,
      newValue: updates.title,
    });
  }

  if (
    updates.description !== undefined &&
    normalizeDescription(updates.description) !==
      normalizeDescription(current.description)
  ) {
    drafts.push({
      field: TaskHistoryField.DESCRIPTION,
      oldValue: normalizeDescription(current.description),
      newValue: normalizeDescription(updates.description),
    });
  }

  if (updates.dueDate !== undefined) {
    const oldDue = formatDueDate(current.dueDate);
    const newDue = updates.dueDate
      ? formatDueDate(new Date(updates.dueDate))
      : null;

    if (oldDue !== newDue) {
      drafts.push({
        field: TaskHistoryField.DUE_DATE,
        oldValue: oldDue,
        newValue: newDue,
      });
    }
  }

  return drafts;
}

if (require.main === module) {
  const drafts = buildTaskHistoryDrafts(
    {
      title: 'Old title',
      description: null,
      dueDate: new Date('2026-06-01T12:00:00.000Z'),
    },
    {
      title: 'Old title',
      description: 'note',
      dueDate: '2026-06-02',
    },
  );

  console.assert(drafts.length === 2, 'expected two history drafts');
  console.assert(
    drafts.some(
      (entry) =>
        entry.field === TaskHistoryField.DESCRIPTION &&
        entry.oldValue === '' &&
        entry.newValue === 'note',
    ),
    'expected description history',
  );
  console.assert(
    drafts.some(
      (entry) =>
        entry.field === TaskHistoryField.DUE_DATE &&
        entry.oldValue === '2026-06-01' &&
        entry.newValue === '2026-06-02',
    ),
    'expected due date history',
  );
}
