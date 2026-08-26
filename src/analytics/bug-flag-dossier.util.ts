export const BUG_FLAG_PRIMARIES = [
  'REAL_DEFECT',
  'INSUFFICIENT_EVIDENCE',
] as const;

export const BUG_FLAG_SECONDARIES = [
  'regression',
  'not_deployed',
  'missing_evidence',
  'missing_repro',
] as const;

export type BugFlagPrimary = (typeof BUG_FLAG_PRIMARIES)[number];
export type BugFlagSecondary = (typeof BUG_FLAG_SECONDARIES)[number];

export type NormalizedBugFlagFields = {
  primary: BugFlagPrimary;
  secondary: BugFlagSecondary[];
  motivo: string;
  evidence: string | null;
  taskScore: number;
  flagScore: number;
};

export function normalizeBugFlagScore(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() !== '') {
    value = Number(value.trim());
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) {
    return null;
  }
  return value;
}

export function isBugFlagPrimary(value: string): value is BugFlagPrimary {
  return (BUG_FLAG_PRIMARIES as readonly string[]).includes(value);
}

export function isBugFlagSecondary(value: string): value is BugFlagSecondary {
  return (BUG_FLAG_SECONDARIES as readonly string[]).includes(value);
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePrimary(value: unknown): BugFlagPrimary | null {
  const raw = asTrimmed(value).replace(/[\s-]+/g, '_').toUpperCase();
  return isBugFlagPrimary(raw) ? raw : null;
}

function normalizeSecondaryList(value: unknown): BugFlagSecondary[] | null {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }

  const seen = new Set<BugFlagSecondary>();
  for (const item of value) {
    const tag = asTrimmed(item).replace(/[\s-]+/g, '_').toLowerCase();
    if (!tag) {
      continue;
    }
    if (!isBugFlagSecondary(tag)) {
      return null;
    }
    seen.add(tag);
  }
  return [...seen];
}

export function normalizeBugFlagFields(input: {
  primary?: unknown;
  secondary?: unknown;
  motivo?: unknown;
  evidence?: unknown;
  taskScore?: unknown;
  flagScore?: unknown;
}): { ok: true; value: NormalizedBugFlagFields } | { ok: false } {
  const primary = normalizePrimary(input.primary);
  const secondary = normalizeSecondaryList(input.secondary);
  const motivo = asTrimmed(input.motivo);
  const evidence = asTrimmed(input.evidence) || null;
  const taskScore = normalizeBugFlagScore(input.taskScore);
  const flagScore = normalizeBugFlagScore(input.flagScore);

  if (!primary || secondary == null || !motivo || taskScore == null || flagScore == null) {
    return { ok: false };
  }

  return {
    ok: true,
    value: { primary, secondary, motivo, evidence, taskScore, flagScore },
  };
}

if (require.main === module) {
  const defect = normalizeBugFlagFields({
    primary: 'real_defect',
    secondary: ['Regression', 'not-deployed', 'regression', ''],
    motivo: '  URL goes to /knowledge  ',
    evidence: ' image.png ',
    taskScore: 7,
    flagScore: '9',
  });
  const missing = normalizeBugFlagFields({
    primary: 'INSUFFICIENT_EVIDENCE',
    secondary: ['missing_evidence', 'missing_repro'],
    motivo: 'No print',
    evidence: '   ',
    taskScore: 3,
    flagScore: 8,
  });
  const emptyMotivo = normalizeBugFlagFields({
    primary: 'REAL_DEFECT',
    secondary: [],
    motivo: '  ',
    taskScore: 5,
    flagScore: 5,
  });
  const badPrimary = normalizeBugFlagFields({
    primary: 'FALSE_POSITIVE',
    motivo: 'x',
    taskScore: 1,
    flagScore: 1,
  });
  const badSecondary = normalizeBugFlagFields({
    primary: 'REAL_DEFECT',
    secondary: ['unknown_tag'],
    motivo: 'x',
    taskScore: 1,
    flagScore: 1,
  });
  const notArray = normalizeBugFlagFields({
    primary: 'REAL_DEFECT',
    secondary: 'regression',
    motivo: 'x',
    taskScore: 1,
    flagScore: 1,
  });
  const badScore = normalizeBugFlagFields({
    primary: 'REAL_DEFECT',
    motivo: 'x',
    taskScore: 0,
    flagScore: 11,
  });
  const missingScore = normalizeBugFlagFields({
    primary: 'REAL_DEFECT',
    motivo: 'x',
  });

  const checks: Array<[string, boolean]> = [
    ['primary fold', defect.ok && defect.value.primary === 'REAL_DEFECT'],
    [
      'secondary unique fold',
      defect.ok &&
        defect.value.secondary.join(',') === 'regression,not_deployed',
    ],
    ['motivo trim', defect.ok && defect.value.motivo === 'URL goes to /knowledge'],
    ['evidence trim', defect.ok && defect.value.evidence === 'image.png'],
    ['empty secondary ok', missing.ok && missing.value.secondary.length === 2],
    ['blank evidence null', missing.ok && missing.value.evidence === null],
    ['task score', defect.ok && defect.value.taskScore === 7],
    ['flag score string', defect.ok && defect.value.flagScore === 9],
    ['empty motivo', !emptyMotivo.ok],
    ['bad primary', !badPrimary.ok],
    ['bad secondary', !badSecondary.ok],
    ['secondary not array', !notArray.ok],
    ['bad score range', !badScore.ok],
    ['missing scores', !missingScore.ok],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'bug-flag-dossier.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`bug-flag-dossier.util ok (${checks.length})`);
}
