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
};

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
}): { ok: true; value: NormalizedBugFlagFields } | { ok: false } {
  const primary = normalizePrimary(input.primary);
  const secondary = normalizeSecondaryList(input.secondary);
  const motivo = asTrimmed(input.motivo);
  const evidence = asTrimmed(input.evidence) || null;

  if (!primary || secondary == null || !motivo) {
    return { ok: false };
  }

  return { ok: true, value: { primary, secondary, motivo, evidence } };
}

if (require.main === module) {
  const defect = normalizeBugFlagFields({
    primary: 'real_defect',
    secondary: ['Regression', 'not-deployed', 'regression', ''],
    motivo: '  URL goes to /knowledge  ',
    evidence: ' image.png ',
  });
  const missing = normalizeBugFlagFields({
    primary: 'INSUFFICIENT_EVIDENCE',
    secondary: ['missing_evidence', 'missing_repro'],
    motivo: 'No print',
    evidence: '   ',
  });
  const emptyMotivo = normalizeBugFlagFields({
    primary: 'REAL_DEFECT',
    secondary: [],
    motivo: '  ',
  });
  const badPrimary = normalizeBugFlagFields({
    primary: 'FALSE_POSITIVE',
    motivo: 'x',
  });
  const badSecondary = normalizeBugFlagFields({
    primary: 'REAL_DEFECT',
    secondary: ['unknown_tag'],
    motivo: 'x',
  });
  const notArray = normalizeBugFlagFields({
    primary: 'REAL_DEFECT',
    secondary: 'regression',
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
    ['empty motivo', !emptyMotivo.ok],
    ['bad primary', !badPrimary.ok],
    ['bad secondary', !badSecondary.ok],
    ['secondary not array', !notArray.ok],
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
