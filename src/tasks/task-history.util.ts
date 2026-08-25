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

function formatBool(value: boolean): string {
  return value ? 'true' : 'false';
}

function normalizeBugReason(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildAssigneeHistoryDraft(
  currentAssigneeId: string | null,
  nextAssigneeId: string | null,
  currentLabel: string | null,
  nextLabel: string | null,
): TaskHistoryDraft | null {
  if (currentAssigneeId === nextAssigneeId) {
    return null;
  }
  return {
    field: TaskHistoryField.ASSIGNEE,
    oldValue: currentLabel,
    newValue: nextLabel,
  };
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

/** Build history rows for bug flag/reason before live columns are wiped (BR-TASK-10). */
export function buildBugHistoryDrafts(
  current: {
    isBug: boolean;
    bugReason: string | null;
  },
  updates: {
    isBug?: boolean;
    bugReason?: string | null;
  },
): TaskHistoryDraft[] {
  const drafts: TaskHistoryDraft[] = [];
  const currentReason = normalizeBugReason(current.bugReason);

  if (updates.isBug !== undefined && updates.isBug !== current.isBug) {
    drafts.push({
      field: TaskHistoryField.IS_BUG,
      oldValue: formatBool(current.isBug),
      newValue: formatBool(updates.isBug),
    });

    if (updates.isBug === true) {
      const nextReason =
        updates.bugReason !== undefined
          ? normalizeBugReason(updates.bugReason)
          : currentReason;
      if (nextReason !== currentReason) {
        drafts.push({
          field: TaskHistoryField.BUG_REASON,
          oldValue: currentReason,
          newValue: nextReason,
        });
      }
    }
    return drafts;
  }

  if (
    updates.bugReason !== undefined &&
    (updates.isBug === true || (updates.isBug === undefined && current.isBug))
  ) {
    const nextReason = normalizeBugReason(updates.bugReason);
    if (nextReason !== currentReason) {
      drafts.push({
        field: TaskHistoryField.BUG_REASON,
        oldValue: currentReason,
        newValue: nextReason,
      });
    }
  }

  return drafts;
}

export function countBugCyclesFromHistory(
  entries: Array<{ field: string; newValue: string | null }>,
): { bugReportCount: number; bugResolveCount: number } {
  let bugReportCount = 0;
  let bugResolveCount = 0;
  for (const entry of entries) {
    if (entry.field !== TaskHistoryField.IS_BUG) {
      continue;
    }
    if (entry.newValue === 'true') {
      bugReportCount += 1;
    } else if (entry.newValue === 'false') {
      bugResolveCount += 1;
    }
  }
  return { bugReportCount, bugResolveCount };
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

  const cycle1 = buildBugHistoryDrafts(
    { isBug: false, bugReason: null },
    { isBug: true, bugReason: 'Falha no checklist item 2' },
  );
  console.assert(cycle1.length === 2, 'expected flag + reason drafts');
  console.assert(
    cycle1[0]?.field === TaskHistoryField.IS_BUG &&
      cycle1[0].oldValue === 'false' &&
      cycle1[0].newValue === 'true',
    'expected isBug true draft',
  );
  console.assert(
    cycle1[1]?.field === TaskHistoryField.BUG_REASON &&
      cycle1[1].newValue === 'Falha no checklist item 2',
    'expected bugReason draft',
  );

  const clear = buildBugHistoryDrafts(
    { isBug: true, bugReason: 'Falha no checklist item 2' },
    { isBug: false },
  );
  console.assert(
    clear.length === 1 &&
      clear[0]?.field === TaskHistoryField.IS_BUG &&
      clear[0].newValue === 'false',
    'expected clear isBug draft only (reason preserved in prior rows)',
  );

  const cycle2 = buildBugHistoryDrafts(
    { isBug: false, bugReason: null },
    { isBug: true, bugReason: 'Regressão após correção' },
  );
  const allIsBug = [...cycle1, ...clear, ...cycle2].filter(
    (d) => d.field === TaskHistoryField.IS_BUG,
  );
  const counts = countBugCyclesFromHistory(allIsBug);
  console.assert(counts.bugReportCount === 2, 'expected 2 reports');
  console.assert(counts.bugResolveCount === 1, 'expected 1 resolve mid-cycle');

  const assigneeDraft = buildAssigneeHistoryDraft(
    'user-1',
    null,
    'wesley',
    null,
  );
  console.assert(
    assigneeDraft?.field === TaskHistoryField.ASSIGNEE &&
      assigneeDraft.oldValue === 'wesley' &&
      assigneeDraft.newValue === null,
    'expected assignee history draft',
  );
  console.assert(
    buildAssigneeHistoryDraft('user-1', 'user-1', 'wesley', 'wesley') === null,
    'expected no assignee draft when unchanged',
  );

  const afterSecondClear = buildBugHistoryDrafts(
    { isBug: true, bugReason: 'Regressão após correção' },
    { isBug: false },
  );
  const fullCounts = countBugCyclesFromHistory([
    ...allIsBug,
    ...afterSecondClear,
  ]);
  console.assert(fullCounts.bugReportCount === 2, 'expected 2 reports after 2 cycles');
  console.assert(fullCounts.bugResolveCount === 2, 'expected 2 resolves after 2 cycles');
}
