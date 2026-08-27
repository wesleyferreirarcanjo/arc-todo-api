export const TASK_LOG_MIME = 'application/json';

export function normalizeLogMime(mime: string | undefined): string {
  return (mime || '').split(';')[0].trim().toLowerCase();
}

export function isAllowedLogMime(mime: string | undefined): boolean {
  return normalizeLogMime(mime) === TASK_LOG_MIME;
}

export function normalizeLogChecklistItemId(
  value: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: 'too_long' } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > 64) {
    return { ok: false, error: 'too_long' };
  }
  return { ok: true, value: trimmed };
}

if (require.main === module) {
  const checks: Array<[string, boolean]> = [
    ['json mime', isAllowedLogMime('application/json')],
    ['json charset', isAllowedLogMime('application/json; charset=utf-8')],
    ['png rejected', isAllowedLogMime('image/png') === false],
    ['empty mime rejected', isAllowedLogMime('') === false],
    ['omit checklist', normalizeLogChecklistItemId(undefined).ok === true],
    [
      'blank checklist',
      (normalizeLogChecklistItemId('  ') as { value: string | null }).value ===
        null,
    ],
    [
      'item id kept',
      (normalizeLogChecklistItemId('item-3') as { value: string | null })
        .value === 'item-3',
    ],
    [
      'too long',
      normalizeLogChecklistItemId('x'.repeat(65)).ok === false,
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'task-log.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`task-log.util ok (${checks.length})`);
}
