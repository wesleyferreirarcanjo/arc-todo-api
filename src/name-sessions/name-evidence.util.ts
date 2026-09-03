import {
  NAME_TLDS,
  combineAvailability,
  countTakenEndings,
  gradeComIncumbency,
  type Availability,
  type IncumbencyGrade,
  type ParkingSignal,
} from './name-check.util';
import {
  buildOrganicCompetition,
  historyStatusForOrganic,
  type AutocompleteEvidence,
  type OrganicCompetition,
} from './name-organic.util';

type DomainCheckLike = {
  tld: string;
  availability: string;
};

type HistoryLike = {
  status?: 'history_found' | 'no_history_found' | 'unknown';
  wayback?: { lastCapture?: string | null; captureCount?: number | null };
  ct?: { latest?: string | null; count?: number | null };
};

export type DomainEvidence<
  C extends DomainCheckLike = DomainCheckLike,
  H extends HistoryLike = HistoryLike,
> = {
  domainChecks: C[];
  domainHistory: H[];
  takenEndingCount: number;
  comIncumbency: {
    grade: IncumbencyGrade;
    parking: ParkingSignal;
    gradedAt: string;
  } | null;
};

export function isComTaken(checks: Array<{ tld?: string; availability?: string }>): boolean {
  return checks.some((check) => check.tld === 'com' && check.availability === 'taken');
}

export function shapeDomainEvidence<
  C extends DomainCheckLike,
  H extends HistoryLike,
>(input: {
  domainChecks: C[];
  domainHistory?: H[];
  parking?: ParkingSignal;
  now?: string;
}): DomainEvidence<C, H> {
  const takenEndingCount = countTakenEndings(input.domainChecks);
  const comCheck = input.domainChecks.find((check) => check.tld === 'com');
  if (!comCheck || comCheck.availability !== 'taken') {
    return {
      domainChecks: input.domainChecks,
      domainHistory: [] as H[],
      takenEndingCount,
      comIncumbency: null,
    };
  }
  const domainHistory = input.domainHistory ?? ([] as H[]);
  const history = domainHistory[0];
  const parking = input.parking ?? 'unknown';
  const grade = gradeComIncumbency({
    comAvailability: comCheck.availability as Availability,
    historyStatus: history?.status ?? 'unknown',
    lastCapture: history?.wayback?.lastCapture ?? null,
    captureCount: history?.wayback?.captureCount ?? null,
    ctLatest: history?.ct?.latest ?? null,
    ctCount: history?.ct?.count ?? null,
    parking,
  });
  return {
    domainChecks: input.domainChecks,
    domainHistory,
    takenEndingCount,
    comIncumbency: {
      grade,
      parking,
      gradedAt: input.now ?? new Date().toISOString(),
    },
  };
}

export function shapeOrganicCompetition(
  checks: Array<{ tld?: string; availability?: string }>,
  domainHistory: Array<{ status?: HistoryLike['status'] }>,
  autocomplete: AutocompleteEvidence,
  now?: string,
): OrganicCompetition {
  return buildOrganicCompetition(
    autocomplete,
    historyStatusForOrganic(isComTaken(checks), domainHistory[0]?.status),
    now,
  );
}

export function shapeCheckEvidence<
  C extends DomainCheckLike,
  H extends HistoryLike,
>(
  domain: DomainEvidence<C, H>,
  autocomplete: AutocompleteEvidence,
  now?: string,
): DomainEvidence<C, H> & { organicCompetition: OrganicCompetition } {
  return {
    ...domain,
    organicCompetition: shapeOrganicCompetition(
      domain.domainChecks,
      domain.domainHistory,
      autocomplete,
      now,
    ),
  };
}

if (require.main === module) {
  const unknownMix = combineAvailability('available', 'unknown');
  const bothUnknown = combineAvailability('unknown', 'unknown');
  const timeoutMix = combineAvailability('unknown', 'available');
  const ladder = NAME_TLDS.map((tld, index) => ({
    tld,
    availability: index % 2 === 0 ? 'taken' : 'unknown',
  }));
  const unresolvedCom = shapeDomainEvidence({
    domainChecks: [
      { tld: 'com', availability: 'taken' },
      { tld: 'com.br', availability: 'unknown' },
    ],
    domainHistory: [{ status: 'unknown' as const }],
    parking: 'unknown',
    now: '2026-09-03T00:00:00.000Z',
  });
  const unknownOrganic = shapeCheckEvidence(
    {
      domainChecks: [{ tld: 'com', availability: 'unknown' }],
      domainHistory: [],
      takenEndingCount: 0,
      comIncumbency: null,
    },
    {
      status: 'unknown',
      suggestions: [],
      checkedAt: '2026-09-03T00:00:00.000Z',
    },
    '2026-09-03T00:00:00.000Z',
  );
  const checks: Array<[string, boolean]> = [
    ['unknown mix never available', unknownMix === 'unknown'],
    ['both unknown never available', bothUnknown === 'unknown'],
    ['timeout mix never available', timeoutMix === 'unknown'],
    [
      'available only when both available',
      combineAvailability('available', 'available') === 'available',
    ],
    [
      'taken endings across ladder',
      NAME_TLDS[0] === 'com' &&
        NAME_TLDS.includes('com.br') &&
        NAME_TLDS.includes('io') &&
        NAME_TLDS.includes('app') &&
        NAME_TLDS.includes('dev') &&
        NAME_TLDS.includes('xyz') &&
        NAME_TLDS.length === 6 &&
        countTakenEndings(ladder) === 3,
    ],
    [
      'unknown endings are not taken',
      countTakenEndings([
        { availability: 'unknown' },
        { availability: 'available' },
        { availability: 'unknown' },
      ]) === 0,
    ],
    [
      'unresolved incumbency stays unknown',
      unresolvedCom.comIncumbency?.grade === 'unknown',
    ],
    [
      'unresolved organic stays unknown',
      unknownOrganic.organicCompetition.status === 'unknown',
    ],
    [
      'unresolved organic never available',
      (unknownOrganic.organicCompetition.status as string) !== 'available' &&
        (unknownOrganic.organicCompetition.status as string) !== 'quiet',
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'name-evidence.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`name-evidence.util ok (${checks.length})`);
}
