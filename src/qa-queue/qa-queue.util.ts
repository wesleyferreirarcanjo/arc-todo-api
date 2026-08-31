import { APP_ERRORS } from '../errors/app-errors';

export type QaQueueListItem = {
  id: string;
  taskId: string;
  position: number;
  displayId: string;
  title: string;
  status: string;
};

export type QaQueueListResponse = {
  projectId: string | null;
  organizationId: string | null;
  items: QaQueueListItem[];
};

export type QueueRow = {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  organizationId: string;
  position: number;
};

export function emptyQueueResponse(): QaQueueListResponse {
  return { projectId: null, organizationId: null, items: [] };
}

/** BR-QA-05: enqueue is allowed in any task status, including before QA Test. */
export function statusMayBeEnqueued(_status: string): boolean {
  return true;
}

/** BR-QA-06: leaving QA Test drops the card from every personal queue. */
export function statusLeftQaTest(previous: string, next: string): boolean {
  return previous === 'qa_test' && next !== 'qa_test';
}

export function enqueueParentsOnly(
  tasks: readonly { parentTaskId?: string | null }[],
): boolean {
  return tasks.every((task) => !task.parentTaskId);
}

export function normalizeAddItemsDto(dto: {
  taskId?: string;
  taskIds?: string[];
  replaceProject?: boolean;
}):
  | { ok: true; taskIds: string[]; replaceProject: boolean }
  | { ok: false; error: 'VAL_REQUEST' } {
  const ids: string[] = [];
  if (typeof dto.taskId === 'string' && dto.taskId.trim()) {
    ids.push(dto.taskId.trim());
  }
  if (dto.taskIds !== undefined) {
    if (!Array.isArray(dto.taskIds)) {
      return { ok: false, error: 'VAL_REQUEST' };
    }
    for (const id of dto.taskIds) {
      if (typeof id !== 'string' || !id.trim()) {
        return { ok: false, error: 'VAL_REQUEST' };
      }
      ids.push(id.trim());
    }
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  if (unique.length === 0) {
    return { ok: false, error: 'VAL_REQUEST' };
  }
  return {
    ok: true,
    taskIds: unique,
    replaceProject: dto.replaceProject === true,
  };
}

export function assertSingleIncomingProject(
  projectIds: string[],
): { ok: true; projectId: string } | { ok: false; error: 'VAL_REQUEST' } {
  if (projectIds.length === 0) {
    return { ok: false, error: 'VAL_REQUEST' };
  }
  const first = projectIds[0];
  if (projectIds.some((id) => id !== first)) {
    return { ok: false, error: 'VAL_REQUEST' };
  }
  return { ok: true, projectId: first };
}

export function detectProjectConflict(
  currentProjectId: string | null,
  incomingProjectId: string,
  replaceProject: boolean,
):
  | { kind: 'ok' }
  | { kind: 'replace'; currentProjectId: string }
  | { kind: 'conflict'; currentProjectId: string } {
  if (!currentProjectId || currentProjectId === incomingProjectId) {
    return { kind: 'ok' };
  }
  if (replaceProject) {
    return { kind: 'replace', currentProjectId };
  }
  return { kind: 'conflict', currentProjectId };
}

export function projectConflictPayload(currentProjectId: string): {
  statusCode: number;
  code: string;
  message: string;
  currentProjectId: string;
} {
  const def = APP_ERRORS.QA_QUEUE_PROJECT_CONFLICT;
  return {
    statusCode: def.status,
    code: def.code,
    message: def.message,
    currentProjectId,
  };
}

export function findDuplicateTaskIds(
  queuedTaskIds: Iterable<string>,
  incomingTaskIds: string[],
): string[] {
  const queued = new Set(queuedTaskIds);
  return incomingTaskIds.filter((id) => queued.has(id));
}

export function nextPosition(maxPosition: number | null | undefined): number {
  if (maxPosition === null || maxPosition === undefined) {
    return 0;
  }
  return maxPosition + 1;
}

export function validateReorder(
  currentItemIds: string[],
  itemIds: string[],
): boolean {
  if (currentItemIds.length !== itemIds.length) {
    return false;
  }
  if (new Set(itemIds).size !== itemIds.length) {
    return false;
  }
  const current = new Set(currentItemIds);
  return itemIds.every((id) => current.has(id));
}

export function enqueueMembershipAllowed(isMember: boolean): boolean {
  return isMember === true;
}

export function currentProjectIdForUser(rows: QueueRow[]): string | null {
  return rows[0]?.projectId ?? null;
}

if (require.main === module) {
  const p1 = 'proj-1';
  const p2 = 'proj-2';
  const org1 = 'org-1';
  const user = 'user-1';

  const empty = emptyQueueResponse();
  const addOne = normalizeAddItemsDto({ taskId: 't1' });
  const addBulk = normalizeAddItemsDto({
    taskIds: ['t2', 't3', 't2'],
    replaceProject: true,
  });
  const addBoth = normalizeAddItemsDto({ taskId: 't1', taskIds: ['t2'] });
  const addNone = normalizeAddItemsDto({});
  const mixed = assertSingleIncomingProject([p1, p2]);
  const same = assertSingleIncomingProject([p1, p1]);
  const conflict = detectProjectConflict(p1, p2, false);
  const replaced = detectProjectConflict(p1, p2, true);
  const sameOk = detectProjectConflict(p1, p1, false);
  const emptyOk = detectProjectConflict(null, p2, false);
  const payload = projectConflictPayload(p1);
  const dups = findDuplicateTaskIds(['t1', 't2'], ['t2', 't3']);
  const reorderOk = validateReorder(['a', 'b', 'c'], ['c', 'a', 'b']);
  const reorderBad = validateReorder(['a', 'b'], ['a', 'a']);
  const reorderMissing = validateReorder(['a', 'b'], ['a']);

  const rows: QueueRow[] = [
    {
      id: 'q1',
      userId: user,
      taskId: 't1',
      projectId: p1,
      organizationId: org1,
      position: 0,
    },
  ];

  const checks: Array<[string, boolean]> = [
    ['empty list not 404', empty.items.length === 0 && empty.projectId === null],
    ['add taskId', addOne.ok && addOne.taskIds[0] === 't1' && !addOne.replaceProject],
    ['add bulk unique', addBulk.ok && addBulk.taskIds.join(',') === 't2,t3'],
    ['replace flag', addBulk.ok && addBulk.replaceProject === true],
    ['merge taskId and taskIds', addBoth.ok && addBoth.taskIds.join(',') === 't1,t2'],
    ['empty body rejected', !addNone.ok],
    ['mixed projects rejected', !mixed.ok],
    ['same project ok', same.ok && same.projectId === p1],
    ['cross-project 409', conflict.kind === 'conflict' && conflict.currentProjectId === p1],
    ['replace clears', replaced.kind === 'replace'],
    ['same project no conflict', sameOk.kind === 'ok'],
    ['empty queue no conflict', emptyOk.kind === 'ok'],
    ['409 has code', payload.code === 'ERR-ARC-QA-03'],
    ['409 has currentProjectId', payload.currentProjectId === p1],
    ['409 status', payload.statusCode === 409],
    ['duplicate detected', dups.length === 1 && dups[0] === 't2'],
    ['no duplicate', findDuplicateTaskIds(['t1'], ['t2']).length === 0],
    ['next pos empty', nextPosition(null) === 0],
    ['next pos append', nextPosition(2) === 3],
    ['reorder permutation', reorderOk],
    ['reorder dup rejected', !reorderBad],
    ['reorder incomplete rejected', !reorderMissing],
    ['member allowed', enqueueMembershipAllowed(true)],
    ['non-member denied', enqueueMembershipAllowed(false) === false],
    ['todo may enqueue', statusMayBeEnqueued('todo')],
    ['qa_test may enqueue', statusMayBeEnqueued('qa_test')],
    ['in_progress may enqueue', statusMayBeEnqueued('in_progress')],
    ['left qa_test', statusLeftQaTest('qa_test', 'done')],
    ['stayed qa_test', statusLeftQaTest('qa_test', 'qa_test') === false],
    ['todo is not leaving qa_test', statusLeftQaTest('todo', 'done') === false],
    ['parents only ok', enqueueParentsOnly([{ parentTaskId: null }])],
    ['nested rejected', enqueueParentsOnly([{ parentTaskId: 'p1' }]) === false],
    ['current project', currentProjectIdForUser(rows) === p1],
    ['current project empty', currentProjectIdForUser([]) === null],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'qa-queue.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`qa-queue.util ok (${checks.length})`);
}
