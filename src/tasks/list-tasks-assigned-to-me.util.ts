/**
 * GET /tasks?assignedToMe=true keeps only tasks whose assignee is the caller.
 * Same query Transform as createdByMe (`'true'` string or boolean).
 */
export const ASSIGNED_TO_ME_SQL = 'task.assigneeId = :userId';

export function parseAssignedToMeFlag(value: unknown): boolean {
  return value === 'true' || value === true;
}

export function shouldFilterAssignedToMe(
  assignedToMe: boolean | undefined,
): boolean {
  return assignedToMe === true;
}

if (require.main === module) {
  const checks: Array<[string, boolean]> = [
    ['string true', parseAssignedToMeFlag('true')],
    ['boolean true', parseAssignedToMeFlag(true)],
    ['string false ignored', parseAssignedToMeFlag('false') === false],
    ['undefined ignored', parseAssignedToMeFlag(undefined) === false],
    ['flag on', shouldFilterAssignedToMe(true)],
    ['flag off', shouldFilterAssignedToMe(false) === false],
    ['flag omitted', shouldFilterAssignedToMe(undefined) === false],
    [
      'sql uses assigneeId',
      ASSIGNED_TO_ME_SQL === 'task.assigneeId = :userId',
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'list-tasks-assigned-to-me.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`list-tasks-assigned-to-me.util ok (${checks.length})`);
}
