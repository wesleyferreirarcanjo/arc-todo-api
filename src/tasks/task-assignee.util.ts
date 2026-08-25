/**
 * Create-time assignee resolution (BR-TASK-18):
 * omitted field → project default (or unassigned if the project has none);
 * explicit null → unassigned even when a default exists;
 * uuid → that user (eligibility checked by the service).
 */
export function resolveCreateAssigneeId(
  requested: string | null | undefined,
  projectDefaultId: string | null | undefined,
): string | null {
  if (requested === undefined) {
    return projectDefaultId ?? null;
  }
  return requested;
}

if (require.main === module) {
  console.assert(
    resolveCreateAssigneeId(undefined, 'user-1') === 'user-1',
    'omit uses project default',
  );
  console.assert(
    resolveCreateAssigneeId(undefined, null) === null,
    'omit with no default is unassigned',
  );
  console.assert(
    resolveCreateAssigneeId(undefined, undefined) === null,
    'omit with missing default is unassigned',
  );
  console.assert(
    resolveCreateAssigneeId(null, 'user-1') === null,
    'explicit null stays unassigned',
  );
  console.assert(
    resolveCreateAssigneeId('user-2', 'user-1') === 'user-2',
    'explicit user wins over default',
  );
}
