import {
  CandidateReaction,
  isCandidateReaction,
  NameBatch,
} from './name-batch.util';
import { median } from './name-check.util';

export type FeedbackCandidate = Record<string, unknown> & {
  id: string;
  name: string;
  laneId?: string | null;
};

export type FeedbackAggregateRow = {
  userId: string;
  candidateId: string;
  ratings: Record<string, unknown> | null;
  concern: string;
  reaction?: string | null;
};

export type BallotRow = {
  candidateId: string;
  reaction?: string | null;
  rememberedSpelling?: string;
  perceivedPurpose?: string;
};

export type BallotGaps = {
  missingReactions: string[];
  missingDepth: string[];
};

export type DecisionPhase = 'ballot' | 'results' | 'faceoff';

export type FinalistError = 'count' | 'unknown' | 'round_open';

export type RoundRecord = {
  id: string;
  candidateIds: string[];
  status: 'open' | 'closed';
  createdAt: string;
  closedAt: string | null;
};

export type StoredFeedbackRow = {
  roundId: string;
  candidateId: string;
  userId: string;
  firstImpression: string;
  rememberedSpelling: string;
  perceivedPurpose: string;
  ratings: Record<string, unknown>;
  concern: string;
  reaction: string | null;
  updatedAt: Date | string;
};

const REACTION_POINTS: Record<CandidateReaction, number> = {
  passed: 0,
  liked: 1,
  loved: 2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasDepth(row: BallotRow): boolean {
  return Boolean(
    row.rememberedSpelling?.trim() && row.perceivedPurpose?.trim(),
  );
}

export function redactCandidate(candidate: FeedbackCandidate): FeedbackCandidate {
  return {
    id: candidate.id,
    name: candidate.name,
    status: 'active',
    sources: [],
    family: null,
    laneId: candidate.laneId ?? null,
    namingGoal: null,
    derivedFromCandidateId: null,
    rationale: '',
    notes: '',
    domainChecks: [],
    googleQueryUrl: '',
    brandChecks: [],
    domainHistory: [],
    takenEndingCount: 0,
    comIncumbency: null,
    organicCompetition: null,
    handleChecks: [],
    visualConcerns: { flags: [], note: '' },
    messaging: {},
    languageChecks: { aiAssisted: null, manual: [] },
    pronunciation: {},
    ratings: {},
  };
}

export function ballotGaps(
  candidateIds: string[],
  rows: BallotRow[],
): BallotGaps {
  const byId = new Map(rows.map((row) => [row.candidateId, row]));
  const missingReactions: string[] = [];
  const missingDepth: string[] = [];
  for (const id of candidateIds) {
    const row = byId.get(id);
    if (!row || !isCandidateReaction(row.reaction)) {
      missingReactions.push(id);
      continue;
    }
    if (row.reaction !== 'passed' && !hasDepth(row)) {
      missingDepth.push(id);
    }
  }
  return { missingReactions, missingDepth };
}

export function hasSubmittedBallot(
  candidateIds: string[],
  rows: BallotRow[],
): boolean {
  const gaps = ballotGaps(candidateIds, rows);
  return gaps.missingReactions.length === 0 && gaps.missingDepth.length === 0;
}

export function ballotGapMessage(gaps: BallotGaps): string {
  if (gaps.missingReactions.length && gaps.missingDepth.length) {
    return `This ballot is incomplete. ${gaps.missingReactions.length} name(s) still need Pass, Like or Love, and ${gaps.missingDepth.length} still need heard spelling and perceived purpose.`;
  }
  if (gaps.missingReactions.length) {
    return 'This ballot is incomplete. Add a Pass, Like or Love for every name, then submit.';
  }
  if (gaps.missingDepth.length) {
    return 'This ballot is incomplete. For every name you did not Pass, add how you would spell it and what you think it does.';
  }
  return 'This ballot is incomplete. Add a Pass, Like or Love for every name, and how you would spell it plus what you think it does for every name you did not Pass.';
}

export function mergeBallotRows(
  existing: BallotRow[],
  incoming: BallotRow[],
): BallotRow[] {
  const byId = new Map<string, BallotRow>();
  for (const row of existing) byId.set(row.candidateId, { ...row });
  for (const row of incoming) {
    const prev = byId.get(row.candidateId);
    byId.set(row.candidateId, prev ? { ...prev, ...row } : { ...row });
  }
  return [...byId.values()];
}

export function shouldRevealRound(input: {
  roundStatus: 'open' | 'closed';
  canManageFeedback: boolean;
  candidateIds: string[];
  submittedRows: BallotRow[];
}): boolean {
  return (
    input.roundStatus === 'closed' ||
    input.canManageFeedback ||
    (input.roundStatus === 'open' &&
      hasSubmittedBallot(input.candidateIds, input.submittedRows))
  );
}

export function decisionPhase(input: {
  roundOpen: boolean;
  submitted: boolean;
}): DecisionPhase {
  if (!input.roundOpen) return 'faceoff';
  return input.submitted ? 'results' : 'ballot';
}

export function projectDecisionSecrets(
  phase: DecisionPhase,
  aggregate: unknown,
  batches: NameBatch[],
): { aggregate: unknown; batches: NameBatch[] } {
  if (phase === 'faceoff') {
    return { aggregate, batches };
  }
  return {
    aggregate: phase === 'ballot' ? null : aggregate,
    batches: batches.map((batch) => ({ ...batch, finalistCandidateIds: [] })),
  };
}

export function validateFinalists(
  candidateIds: string[],
  batchCandidateIds: string[],
  roundOpen: boolean,
):
  | { ok: true; ids: string[] }
  | { ok: false; error: FinalistError } {
  if (roundOpen) return { ok: false, error: 'round_open' };
  const unique = [...new Set(candidateIds)];
  if (candidateIds.length !== 2 || unique.length !== 2) {
    return { ok: false, error: 'count' };
  }
  if (!unique.every((id) => batchCandidateIds.includes(id))) {
    return { ok: false, error: 'unknown' };
  }
  return { ok: true, ids: unique };
}

export function finalistAppError(
  error: FinalistError,
): 'NAME_FINALISTS_ROUND_OPEN' | 'NAME_FINALISTS' {
  return error === 'round_open' ? 'NAME_FINALISTS_ROUND_OPEN' : 'NAME_FINALISTS';
}

function emptyReactions() {
  return { passed: 0, liked: 0, loved: 0 };
}

export function aggregateRound(rows: FeedbackAggregateRow[]) {
  const participantIds = new Set(rows.map((row) => row.userId));
  const byCandidate: Record<
    string,
    {
      responses: number;
      easyToSay: number | null;
      memorable: number | null;
      fitsProduct: number | null;
      repeatedConcerns: string[];
      reactions: { passed: number; liked: number; loved: number };
      points: number;
    }
  > = {};
  const grouped = new Map<string, FeedbackAggregateRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.candidateId) ?? [];
    list.push(row);
    grouped.set(row.candidateId, list);
  }
  for (const [candidateId, list] of grouped) {
    const num = (key: string) =>
      list
        .map((row) => {
          const value = (row.ratings ?? {})[key];
          return typeof value === 'number' ? value : null;
        })
        .filter((value): value is number => value != null);
    const concernCounts = new Map<string, number>();
    const reactions = emptyReactions();
    let points = 0;
    for (const row of list) {
      const concern = row.concern.trim().toLowerCase();
      if (concern) {
        concernCounts.set(concern, (concernCounts.get(concern) ?? 0) + 1);
      }
      if (isCandidateReaction(row.reaction)) {
        reactions[row.reaction] += 1;
        points += REACTION_POINTS[row.reaction];
      }
    }
    byCandidate[candidateId] = {
      responses: list.length,
      easyToSay: median(num('easyToSay')),
      memorable: median(num('memorable')),
      fitsProduct: median(num('fitsProduct')),
      repeatedConcerns: [...concernCounts.entries()]
        .filter(([, count]) => count >= 2)
        .map(([text]) => text),
      reactions,
      points,
    };
  }
  return {
    participantCount: participantIds.size,
    byCandidate,
  };
}

export function reactionPointsFromRows(
  rows: Array<{ candidateId: string; reaction?: string | null }>,
): Record<string, number> {
  const points: Record<string, number> = {};
  for (const row of rows) {
    if (!isCandidateReaction(row.reaction)) continue;
    points[row.candidateId] =
      (points[row.candidateId] ?? 0) + REACTION_POINTS[row.reaction];
  }
  return points;
}

export function reactionPointsFromUserRatings(
  candidates: Array<{ id: string; userRatings?: unknown }>,
  scopeIds: string[],
): Record<string, number> {
  const points: Record<string, number> = {};
  for (const id of scopeIds) points[id] = 0;
  const scope = new Set(scopeIds);
  for (const candidate of candidates) {
    if (!scope.has(candidate.id) || !isRecord(candidate.userRatings)) continue;
    for (const row of Object.values(candidate.userRatings)) {
      if (!isRecord(row) || !isCandidateReaction(row.reaction)) continue;
      points[candidate.id] += REACTION_POINTS[row.reaction];
    }
  }
  return points;
}

export function winnerReactionPoints(
  ballotRows: Array<{ candidateId: string; reaction?: string | null }>,
  candidates: Array<{ id: string; userRatings?: unknown }>,
  scopeIds: string[],
): Record<string, number> {
  const ballotUsed = ballotRows.some((row) => isCandidateReaction(row.reaction));
  const raw = ballotUsed
    ? reactionPointsFromRows(ballotRows)
    : reactionPointsFromUserRatings(candidates, scopeIds);
  const points: Record<string, number> = {};
  for (const id of scopeIds) points[id] = raw[id] ?? 0;
  return points;
}

export function isBelowTopPick(
  candidateId: string,
  candidateIds: string[],
  pointsByCandidate: Record<string, number>,
  decisionNote: string | undefined,
): boolean {
  if (decisionNote?.trim()) return false;
  let top = Number.NEGATIVE_INFINITY;
  for (const id of candidateIds) {
    const value = pointsByCandidate[id] ?? 0;
    if (value > top) top = value;
  }
  if (top === Number.NEGATIVE_INFINITY) return false;
  const chosen = pointsByCandidate[candidateId] ?? 0;
  return chosen < top;
}

export function patchFeedbackRow<
  T extends {
    firstImpression: string;
    rememberedSpelling: string;
    perceivedPurpose: string;
    ratings: Record<string, unknown>;
    concern: string;
    reaction: string | null;
  },
>(
  row: T,
  entry: {
    firstImpression?: string;
    rememberedSpelling?: string;
    perceivedPurpose?: string;
    ratings?: object;
    concern?: string;
    reaction?: string;
  },
): T {
  if (entry.firstImpression !== undefined) {
    row.firstImpression = entry.firstImpression;
  }
  if (entry.rememberedSpelling !== undefined) {
    row.rememberedSpelling = entry.rememberedSpelling;
  }
  if (entry.perceivedPurpose !== undefined) {
    row.perceivedPurpose = entry.perceivedPurpose;
  }
  if (entry.ratings !== undefined) {
    row.ratings = { ...(entry.ratings as Record<string, unknown>) };
  }
  if (entry.concern !== undefined) {
    row.concern = entry.concern;
  }
  if (entry.reaction !== undefined) {
    row.reaction = entry.reaction;
  }
  return row;
}

export function asRounds(value: unknown): RoundRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is RoundRecord =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as RoundRecord).id === 'string' &&
      Array.isArray((item as RoundRecord).candidateIds),
  );
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function shuffledIds(ids: string[], seed: string): string[] {
  const copy = [...ids];
  let n = hashSeed(seed) + 1;
  for (let i = copy.length - 1; i > 0; i--) {
    n = (n * 1103515245 + 12345) & 0x7fffffff;
    const j = n % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function shapeSessionDecision(input: {
  rounds: RoundRecord[];
  allRows: StoredFeedbackRow[];
  userId: string;
  isOwner: boolean;
  batches: NameBatch[];
}) {
  const openRound = input.rounds.find((round) => round.status === 'open');
  const openMine = openRound
    ? input.allRows.filter(
        (row) => row.roundId === openRound.id && row.userId === input.userId,
      )
    : [];
  const submitted = openRound
    ? hasSubmittedBallot(openRound.candidateIds, openMine)
    : true;
  const phase = decisionPhase({
    roundOpen: Boolean(openRound),
    submitted,
  });
  const redactCandidateIds =
    openRound &&
    !shouldRevealRound({
      roundStatus: openRound.status,
      canManageFeedback: input.isOwner,
      candidateIds: openRound.candidateIds,
      submittedRows: openMine,
    })
      ? openRound.candidateIds
      : null;
  const secrets = projectDecisionSecrets(phase, true, input.batches);
  const feedback = input.rounds.map((round) => {
    const roundRows = input.allRows.filter((row) => row.roundId === round.id);
    const myRows = roundRows.filter((row) => row.userId === input.userId);
    return {
      ...round,
      order: shuffledIds(round.candidateIds, `${round.id}:${input.userId}`),
      mine: myRows.map((row) => ({
        candidateId: row.candidateId,
        reaction: row.reaction ?? null,
        firstImpression: row.firstImpression,
        rememberedSpelling: row.rememberedSpelling,
        perceivedPurpose: row.perceivedPurpose,
        ratings: row.ratings,
        concern: row.concern,
        updatedAt: row.updatedAt,
      })),
      aggregate: phase === 'ballot' ? null : aggregateRound(roundRows),
    };
  });
  return {
    decisionPhase: phase,
    batches: secrets.batches,
    redactCandidateIds,
    feedback,
  };
}

if (require.main === module) {
  const full: FeedbackCandidate = {
    id: 'c1',
    name: 'Helios',
    laneId: 'lane-1',
    sources: ['human'],
    rationale: 'secret why',
    domainChecks: [{ tld: 'com', availability: 'taken' }],
    brandChecks: [{ query: 'Helios' }],
    ratings: { overall: 8, easyToSay: 4 },
    organicCompetition: { status: 'crowded' },
  };
  const redacted = redactCandidate(full);
  const evenRows: FeedbackAggregateRow[] = [
    { userId: 'a', candidateId: 'c1', ratings: { easyToSay: 1, memorable: 2, fitsProduct: 4 }, concern: 'Hard to say', reaction: 'loved' },
    { userId: 'b', candidateId: 'c1', ratings: { easyToSay: 2, memorable: 4, fitsProduct: 6 }, concern: 'HARD TO SAY', reaction: 'liked' },
    { userId: 'c', candidateId: 'c1', ratings: { easyToSay: 3, memorable: 6, fitsProduct: 8 }, concern: 'Too long', reaction: 'passed' },
    { userId: 'd', candidateId: 'c1', ratings: { easyToSay: 4, memorable: 8, fitsProduct: 10 }, concern: '', reaction: 'loved' },
  ];
  const onceRows: FeedbackAggregateRow[] = [
    { userId: 'a', candidateId: 'c1', ratings: {}, concern: 'Unique worry' },
    { userId: 'b', candidateId: 'c1', ratings: {}, concern: 'Something else' },
  ];
  const even = aggregateRound(evenRows).byCandidate.c1;
  const once = aggregateRound(onceRows).byCandidate.c1;
  const openIds = ['c1', 'c2'];
  const phaseOneOnly: BallotRow[] = [
    { candidateId: 'c1', reaction: 'liked' },
    { candidateId: 'c2', reaction: 'passed' },
  ];
  const passedOk: BallotRow[] = [
    { candidateId: 'c1', reaction: 'passed' },
    { candidateId: 'c2', reaction: 'passed' },
  ];
  const likedComplete: BallotRow[] = [
    {
      candidateId: 'c1',
      reaction: 'liked',
      rememberedSpelling: 'Helios',
      perceivedPurpose: 'A task app',
    },
    { candidateId: 'c2', reaction: 'passed' },
  ];
  const secondVote = mergeBallotRows(likedComplete, [
    {
      candidateId: 'c1',
      reaction: 'loved',
      rememberedSpelling: 'Helios',
      perceivedPurpose: 'A calmer task app',
    },
  ]);
  const sampleBatch: NameBatch = {
    number: 1,
    candidateIds: ['c1', 'c2', 'c3'],
    status: 'open',
    winnerCandidateId: null,
    decisionNote: null,
    roundId: null,
    createdAt: 't',
    decidedAt: null,
    finalistCandidateIds: ['c1', 'c2'],
  };
  const ballotSecrets = projectDecisionSecrets('ballot', { participantCount: 3 }, [
    sampleBatch,
  ]);
  const resultsSecrets = projectDecisionSecrets(
    'results',
    { participantCount: 3 },
    [sampleBatch],
  );
  const faceoffSecrets = projectDecisionSecrets(
    'faceoff',
    { participantCount: 3 },
    [sampleBatch],
  );
  const twoOk = validateFinalists(['c1', 'c2'], sampleBatch.candidateIds, false);
  const oneFinalist = validateFinalists(['c1'], sampleBatch.candidateIds, false);
  const dupFinalist = validateFinalists(
    ['c1', 'c1'],
    sampleBatch.candidateIds,
    false,
  );
  const unknownFinalist = validateFinalists(
    ['c1', 'z'],
    sampleBatch.candidateIds,
    false,
  );
  const openFinalist = validateFinalists(
    ['c1', 'c2'],
    sampleBatch.candidateIds,
    true,
  );
  const points = { a: 4, b: 2, c: 1 };
  const checks: Array<[string, boolean]> = [
    ['redact keeps id', redacted.id === 'c1'],
    ['redact keeps name', redacted.name === 'Helios'],
    ['redact keeps lane', redacted.laneId === 'lane-1'],
    [
      'redact strips checks',
      Array.isArray(redacted.domainChecks) &&
        (redacted.domainChecks as unknown[]).length === 0 &&
        Array.isArray(redacted.brandChecks) &&
        (redacted.brandChecks as unknown[]).length === 0,
    ],
    [
      'redact strips ratings',
      Boolean(redacted.ratings) &&
        typeof redacted.ratings === 'object' &&
        Object.keys(redacted.ratings as object).length === 0,
    ],
    [
      'redact strips sources',
      Array.isArray(redacted.sources) && (redacted.sources as unknown[]).length === 0,
    ],
    ['redact strips rationale', redacted.rationale === ''],
    ['median even easyToSay', even.easyToSay === 2.5],
    ['median even memorable', even.memorable === 5],
    ['median even fitsProduct', even.fitsProduct === 7],
    [
      'concern twice is repeated',
      even.repeatedConcerns.includes('hard to say') &&
        even.repeatedConcerns.length === 1,
    ],
    ['concern once is not repeated', once.repeatedConcerns.length === 0],
    [
      'reaction distribution and points',
      even.reactions.loved === 2 &&
        even.reactions.liked === 1 &&
        even.reactions.passed === 1 &&
        even.points === 5,
    ],
    [
      'phase-one-only ballot is not submitted',
      hasSubmittedBallot(openIds, phaseOneOnly) === false &&
        ballotGaps(openIds, phaseOneOnly).missingDepth.join() === 'c1',
    ],
    [
      'passing makes phase-two optional',
      hasSubmittedBallot(openIds, passedOk) === true,
    ],
    [
      'liking makes phase-two required',
      hasSubmittedBallot(openIds, [
        { candidateId: 'c1', reaction: 'liked' },
        { candidateId: 'c2', reaction: 'passed' },
      ]) === false &&
        hasSubmittedBallot(openIds, likedComplete) === true,
    ],
    [
      'ballot phase hides totals and finalists',
      ballotSecrets.aggregate === null &&
        ballotSecrets.batches[0].finalistCandidateIds.length === 0,
    ],
    [
      'results phase keeps totals and hides finalists',
      resultsSecrets.aggregate !== null &&
        resultsSecrets.batches[0].finalistCandidateIds.length === 0,
    ],
    [
      'faceoff phase returns finalist ids',
      faceoffSecrets.batches[0].finalistCandidateIds.join() === 'c1,c2',
    ],
    [
      'second submission updates rather than duplicates',
      secondVote.length === 2 &&
        secondVote.find((row) => row.candidateId === 'c1')?.reaction === 'loved' &&
        secondVote.find((row) => row.candidateId === 'c1')?.perceivedPurpose ===
          'A calmer task app',
    ],
    [
      'below-top without a note is refused',
      isBelowTopPick('b', ['a', 'b', 'c'], points, undefined) === true,
    ],
    [
      'below-top with a note is allowed',
      isBelowTopPick('b', ['a', 'b', 'c'], points, 'taste') === false,
    ],
    [
      'tied top does not need a note',
      isBelowTopPick('a', ['a', 'b'], { a: 2, b: 2 }, undefined) === false,
    ],
    [
      'finalists must be exactly two from the batch',
      twoOk.ok === true &&
        oneFinalist.ok === false &&
        oneFinalist.error === 'count' &&
        dupFinalist.ok === false &&
        dupFinalist.error === 'count' &&
        unknownFinalist.ok === false &&
        unknownFinalist.error === 'unknown' &&
        openFinalist.ok === false &&
        openFinalist.error === 'round_open',
    ],
    [
      'reveal false for non-submitter',
      shouldRevealRound({
        roundStatus: 'open',
        canManageFeedback: false,
        candidateIds: openIds,
        submittedRows: [{ candidateId: 'c1', reaction: 'passed' }],
      }) === false,
    ],
    [
      'reveal true after complete ballot',
      shouldRevealRound({
        roundStatus: 'open',
        canManageFeedback: false,
        candidateIds: openIds,
        submittedRows: passedOk,
      }) === true,
    ],
    [
      'reveal true when closed',
      shouldRevealRound({
        roundStatus: 'closed',
        canManageFeedback: false,
        candidateIds: openIds,
        submittedRows: [],
      }) === true,
    ],
    [
      'reveal true for manager',
      shouldRevealRound({
        roundStatus: 'open',
        canManageFeedback: true,
        candidateIds: openIds,
        submittedRows: [],
      }) === true,
    ],
    [
      'open unsubmitted is ballot',
      decisionPhase({ roundOpen: true, submitted: false }) === 'ballot',
    ],
    [
      'open submitted is results',
      decisionPhase({ roundOpen: true, submitted: true }) === 'results',
    ],
    [
      'closed round is faceoff',
      decisionPhase({ roundOpen: false, submitted: false }) === 'faceoff',
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'name-feedback.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`name-feedback.util ok (${checks.length})`);
}
