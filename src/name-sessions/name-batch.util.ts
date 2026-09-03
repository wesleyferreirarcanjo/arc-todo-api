export type CandidateReaction = 'passed' | 'liked' | 'loved';

export type BatchCandidate = {
  id: string;
  batchNumber?: number;
  userRatings?: unknown;
};

export type NameBatch = {
  number: number;
  candidateIds: string[];
  status: 'open' | 'decided';
  winnerCandidateId: string | null;
  decisionNote: string | null;
  roundId: string | null;
  createdAt: string;
  decidedAt: string | null;
  finalistCandidateIds: string[];
};

export type BatchValidationError = 'size' | 'unknown' | 'already_batched';

export type BatchCrownError = 'decided' | 'other_open' | 'not_in_batch';

const REACTIONS: CandidateReaction[] = ['passed', 'liked', 'loved'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isCandidateReaction(
  value: unknown,
): value is CandidateReaction {
  return typeof value === 'string' && REACTIONS.includes(value as CandidateReaction);
}

export function effectiveBatchNumber(candidate: {
  batchNumber?: unknown;
}): number {
  return typeof candidate.batchNumber === 'number' &&
    Number.isInteger(candidate.batchNumber)
    ? candidate.batchNumber
    : 1;
}

export function isBatched(candidate: unknown): boolean {
  return (
    isRecord(candidate) &&
    typeof candidate.batchNumber === 'number' &&
    Number.isInteger(candidate.batchNumber)
  );
}

export function unbatchedCandidates<T>(candidates: T[]): T[] {
  return candidates.filter((candidate) => !isBatched(candidate));
}

export function asBatches(value: unknown): NameBatch[] {
  if (!Array.isArray(value)) return [];
  const out: NameBatch[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.number !== 'number' || !Array.isArray(item.candidateIds)) {
      continue;
    }
    if (item.status !== 'open' && item.status !== 'decided') continue;
    out.push({
      ...(item as NameBatch),
      finalistCandidateIds: Array.isArray(item.finalistCandidateIds)
        ? item.finalistCandidateIds.filter(
            (id): id is string => typeof id === 'string',
          )
        : [],
    });
  }
  return out;
}

export function nextBatchNumber(batches: NameBatch[]): number {
  if (!batches.length) return 1;
  return Math.max(...batches.map((batch) => batch.number)) + 1;
}

function reactionOf(
  candidate: BatchCandidate,
  userId: string,
): CandidateReaction | undefined {
  if (!isRecord(candidate.userRatings)) return undefined;
  const row = candidate.userRatings[userId];
  if (!isRecord(row)) return undefined;
  return isCandidateReaction(row.reaction) ? row.reaction : undefined;
}

export function batchSurvivors<T extends BatchCandidate>(
  candidates: T[],
  batchNumber: number,
  userId: string,
): T[] {
  return candidates.filter((candidate) => {
    if (effectiveBatchNumber(candidate) !== batchNumber) return false;
    const reaction = reactionOf(candidate, userId);
    return reaction === 'liked' || reaction === 'loved';
  });
}

export function validateNewBatch(
  candidateIds: string[],
  candidates: Array<{ id: string; batchNumber?: unknown }>,
  recommendedCandidateId: string | null,
):
  | { ok: true; freshIds: string[]; championId: string | null }
  | { ok: false; error: BatchValidationError } {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const uniqueIds = [...new Set(candidateIds)];
  const championExists =
    !!recommendedCandidateId && byId.has(recommendedCandidateId);
  const championId = championExists ? recommendedCandidateId : null;
  const freshIds = uniqueIds.filter((id) => id !== championId);
  for (const id of freshIds) {
    const candidate = byId.get(id);
    if (!candidate) return { ok: false, error: 'unknown' };
    if (isBatched(candidate)) return { ok: false, error: 'already_batched' };
  }
  if (freshIds.length < 10 || freshIds.length > 20) {
    return { ok: false, error: 'size' };
  }
  return { ok: true, freshIds, championId };
}

export function canCrown(
  batch: NameBatch,
  batches: NameBatch[],
): { ok: true } | { ok: false; error: Exclude<BatchCrownError, 'not_in_batch'> } {
  if (batch.status === 'decided') return { ok: false, error: 'decided' };
  if (batches.some((item) => item.number !== batch.number && item.status === 'open')) {
    return { ok: false, error: 'other_open' };
  }
  return { ok: true };
}

export function hasOpenBatch(batches: NameBatch[]): boolean {
  return batches.some((batch) => batch.status === 'open');
}

export function batchValidationAppError(
  error: BatchValidationError,
): 'NAME_BATCH_SIZE' | 'NAME_BATCH_UNKNOWN' | 'NAME_BATCH_ALREADY' {
  if (error === 'size') return 'NAME_BATCH_SIZE';
  if (error === 'unknown') return 'NAME_BATCH_UNKNOWN';
  return 'NAME_BATCH_ALREADY';
}

export function stampOpenBatch<T extends { id: string; batchNumber?: unknown }>(
  candidates: T[],
  batches: NameBatch[],
  parsed: { freshIds: string[]; championId: string | null },
  now: string,
): NameBatch {
  const number = nextBatchNumber(batches);
  const candidateIds = [
    ...(parsed.championId ? [parsed.championId] : []),
    ...parsed.freshIds,
  ];
  const selected = new Set(candidateIds);
  for (const candidate of candidates) {
    if (selected.has(candidate.id)) candidate.batchNumber = number;
  }
  const batch: NameBatch = {
    number,
    candidateIds,
    status: 'open',
    winnerCandidateId: null,
    decisionNote: null,
    roundId: null,
    createdAt: now,
    decidedAt: null,
    finalistCandidateIds: [],
  };
  batches.push(batch);
  return batch;
}

export function decideBatch(
  batch: NameBatch,
  candidateId: string,
  decisionNote: string | undefined,
  now: string,
): void {
  batch.status = 'decided';
  batch.winnerCandidateId = candidateId;
  batch.decidedAt = now;
  if (decisionNote !== undefined) batch.decisionNote = decisionNote;
}

if (require.main === module) {
  const ids = (n: number) =>
    Array.from({ length: n }, (_, i) => `c${String(i + 1).padStart(2, '0')}`);
  const ten = ids(10).map((id) => ({ id }));
  const nine = ids(9).map((id) => ({ id }));
  const twentyOne = ids(21).map((id) => ({ id }));
  const withChampion: Array<{ id: string; batchNumber?: number }> = [
    { id: 'champ', batchNumber: 1 },
    ...ten,
  ];
  const already = [{ id: 'c01' }, { id: 'old', batchNumber: 1 }, ...ids(9).slice(1).map((id) => ({ id }))];
  const passedLoved = [
    {
      id: 'c01',
      batchNumber: 2,
      userRatings: { u1: { reaction: 'passed', updatedAt: 't' } },
    },
    {
      id: 'c02',
      batchNumber: 2,
      userRatings: { u1: { reaction: 'liked', updatedAt: 't' } },
    },
    {
      id: 'c03',
      batchNumber: 2,
      userRatings: {
        u1: { reaction: 'loved', updatedAt: 't' },
        u2: { reaction: 'passed', updatedAt: 't' },
      },
    },
    {
      id: 'c04',
      batchNumber: 1,
      userRatings: { u1: { reaction: 'loved', updatedAt: 't' } },
    },
  ];
  const open: NameBatch = {
    number: 1,
    candidateIds: ['c01'],
    status: 'open',
    winnerCandidateId: null,
    decisionNote: null,
    roundId: null,
    createdAt: 't',
    decidedAt: null,
    finalistCandidateIds: [],
  };
  const decided: NameBatch = { ...open, status: 'decided', winnerCandidateId: 'c01' };
  const otherOpen: NameBatch = { ...open, number: 2 };
  const size9 = validateNewBatch(ids(9), nine, null);
  const size21 = validateNewBatch(ids(21), twentyOne, null);
  const champOk = validateNewBatch(
    ids(10),
    withChampion,
    'champ',
  );
  const champInList = validateNewBatch(
    ['champ', ...ids(10)],
    withChampion,
    'champ',
  );
  const unknown = validateNewBatch(['nope', ...ids(9)], ten, null);
  const batched = validateNewBatch(
    ['old', ...ids(9).slice(1)],
    already,
    null,
  );
  const survivors = batchSurvivors(passedLoved, 2, 'u1');
  const missingBatch = effectiveBatchNumber({ id: 'x' } as BatchCandidate);
  const crownDecided = canCrown(decided, [decided]);
  const crownOther = canCrown(open, [open, otherOpen]);
  const crownOk = canCrown(open, [open]);
  const checks: Array<[string, boolean]> = [
    ['missing batchNumber reads as 1', missingBatch === 1],
    ['9 fresh names is refused', size9.ok === false && size9.error === 'size'],
    ['21 fresh names is refused', size21.ok === false && size21.error === 'size'],
    [
      'champion included without consuming a slot',
      champOk.ok === true &&
        champOk.freshIds.length === 10 &&
        champOk.championId === 'champ',
    ],
    [
      'champion in the payload still does not consume a slot',
      champInList.ok === true &&
        champInList.freshIds.length === 10 &&
        champInList.championId === 'champ',
    ],
    ['unknown candidate id is refused', unknown.ok === false && unknown.error === 'unknown'],
    [
      'already batched id is refused',
      batched.ok === false && batched.error === 'already_batched',
    ],
    [
      'passed is excluded from survivors',
      survivors.map((row) => row.id).join(',') === 'c02,c03',
    ],
    ['decided batch refuses a second crown', crownDecided.ok === false && crownDecided.error === 'decided'],
    ['another open batch refuses crown', crownOther.ok === false && crownOther.error === 'other_open'],
    ['open batch can be crowned', crownOk.ok === true],
    ['unbatched omits stamped names', unbatchedCandidates(withChampion).length === 10],
    ['next batch number after empty is 1', nextBatchNumber([]) === 1],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'name-batch.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`name-batch.util ok (${checks.length})`);
}
