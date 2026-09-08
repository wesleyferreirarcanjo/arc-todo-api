import {
  asRounds,
  hasSubmittedBallot,
  isBelowTopPick,
  RoundRecord,
  StoredFeedbackRow,
} from './name-feedback.util';

export type ParticipationMode = 'solo' | 'team';

export const DEFAULT_PARTICIPATION_MODE: ParticipationMode = 'solo';

export type ParticipationSwitchError = 'invalid' | 'round_open';

export type ParticipationProgress = {
  submittedCount: number;
  eligibleCount: number;
};

const MODES: ParticipationMode[] = ['solo', 'team'];

export function isParticipationMode(
  value: unknown,
): value is ParticipationMode {
  return typeof value === 'string' && MODES.includes(value as ParticipationMode);
}

export function hasFeedbackHistory(rounds: unknown): boolean {
  return asRounds(rounds).length > 0;
}

export function resolveParticipationMode(
  stored: unknown,
  rounds: unknown,
): ParticipationMode {
  if (isParticipationMode(stored)) return stored;
  return hasFeedbackHistory(rounds) ? 'team' : 'solo';
}

export function validateParticipationSwitch(input: {
  stored: unknown;
  rounds: unknown;
  next: unknown;
}):
  | { ok: true; mode: ParticipationMode }
  | { ok: false; error: ParticipationSwitchError } {
  if (!isParticipationMode(input.next)) {
    return { ok: false, error: 'invalid' };
  }
  const current = resolveParticipationMode(input.stored, input.rounds);
  if (current === input.next) {
    return { ok: true, mode: input.next };
  }
  const open = asRounds(input.rounds).some((round) => round.status === 'open');
  if (open) {
    return { ok: false, error: 'round_open' };
  }
  return { ok: true, mode: input.next };
}

export function participationSwitchAppError(
  error: ParticipationSwitchError,
): 'NAME_PARTICIPATION_INVALID' | 'NAME_PARTICIPATION_ROUND_OPEN' {
  return error === 'invalid'
    ? 'NAME_PARTICIPATION_INVALID'
    : 'NAME_PARTICIPATION_ROUND_OPEN';
}

export function canStartFeedbackRound(mode: ParticipationMode): boolean {
  return mode === 'team';
}

export function winnerScopeIds(
  candidateId: string,
  batches: Array<{ candidateIds: string[] }>,
  allCandidateIds: string[],
  scopeIds?: string[],
): string[] {
  if (scopeIds) return scopeIds;
  const batch = batches.find((item) => item.candidateIds.includes(candidateId));
  return batch?.candidateIds ?? allCandidateIds;
}

export function submittedVoterIds(
  candidateIds: string[],
  rows: Array<
    Pick<
      StoredFeedbackRow,
      | 'userId'
      | 'candidateId'
      | 'reaction'
      | 'rememberedSpelling'
      | 'perceivedPurpose'
    >
  >,
): string[] {
  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }
  const submitted: string[] = [];
  for (const [userId, userRows] of byUser) {
    if (hasSubmittedBallot(candidateIds, userRows)) {
      submitted.push(userId);
    }
  }
  return submitted;
}

export function shapeParticipationProgress(input: {
  openRound: RoundRecord | undefined;
  allRows: Array<
    Pick<
      StoredFeedbackRow,
      | 'roundId'
      | 'userId'
      | 'candidateId'
      | 'reaction'
      | 'rememberedSpelling'
      | 'perceivedPurpose'
    >
  >;
  eligibleCount: number;
}): ParticipationProgress | null {
  if (!input.openRound) return null;
  const roundRows = input.allRows.filter(
    (row) => row.roundId === input.openRound!.id,
  );
  return {
    submittedCount: submittedVoterIds(input.openRound.candidateIds, roundRows)
      .length,
    eligibleCount: Math.max(0, input.eligibleCount),
  };
}

if (require.main === module) {
  const openRound: RoundRecord = {
    id: 'r1',
    candidateIds: ['c1', 'c2'],
    status: 'open',
    createdAt: 't',
    closedAt: null,
  };
  const closedRound: RoundRecord = {
    ...openRound,
    id: 'r0',
    status: 'closed',
    closedAt: 't2',
  };
  const completeA = {
    roundId: 'r1',
    userId: 'a',
    candidateId: 'c1',
    reaction: 'passed',
    rememberedSpelling: '',
    perceivedPurpose: '',
  };
  const completeA2 = {
    ...completeA,
    candidateId: 'c2',
    reaction: 'liked',
    rememberedSpelling: 'Helios',
    perceivedPurpose: 'A task app',
  };
  const incompleteB = {
    roundId: 'r1',
    userId: 'b',
    candidateId: 'c1',
    reaction: 'liked',
    rememberedSpelling: '',
    perceivedPurpose: '',
  };
  const progress = shapeParticipationProgress({
    openRound,
    allRows: [completeA, completeA2, incompleteB],
    eligibleCount: 4,
  });
  const switchOpen = validateParticipationSwitch({
    stored: 'team',
    rounds: [openRound],
    next: 'solo',
  });
  const switchSame = validateParticipationSwitch({
    stored: 'team',
    rounds: [openRound],
    next: 'team',
  });
  const switchClosed = validateParticipationSwitch({
    stored: 'team',
    rounds: [closedRound],
    next: 'solo',
  });
  const checks: Array<[string, boolean]> = [
    [
      'new sessions default to solo',
      DEFAULT_PARTICIPATION_MODE === 'solo' &&
        resolveParticipationMode(null, []) === 'solo',
    ],
    [
      'legacy without feedback is solo',
      resolveParticipationMode(null, []) === 'solo',
    ],
    [
      'legacy with feedback is team',
      resolveParticipationMode(null, [closedRound]) === 'team',
    ],
    [
      'stored solo wins over leftover feedback',
      resolveParticipationMode('solo', [closedRound]) === 'solo',
    ],
    [
      'open-round switch to solo is refused',
      switchOpen.ok === false && switchOpen.error === 'round_open',
    ],
    [
      'same mode during an open round is allowed',
      switchSame.ok === true && switchSame.mode === 'team',
    ],
    [
      'closed-round switch to solo is allowed',
      switchClosed.ok === true && switchClosed.mode === 'solo',
    ],
    [
      'invalid mode is refused',
      validateParticipationSwitch({
        stored: 'solo',
        rounds: [],
        next: 'public',
      }).ok === false,
    ],
    [
      'solo cannot start a feedback round',
      canStartFeedbackRound('solo') === false &&
        canStartFeedbackRound('team') === true,
    ],
    [
      'solo no-batch winner uses every candidate',
      winnerScopeIds('c2', [], ['c1', 'c2', 'c3']).join() === 'c1,c2,c3',
    ],
    [
      'batch winner stays inside that batch',
      winnerScopeIds(
        'c2',
        [{ candidateIds: ['c1', 'c2'] }],
        ['c1', 'c2', 'c3'],
      ).join() === 'c1,c2',
    ],
    [
      'progress is counts only',
      progress !== null &&
        progress.submittedCount === 1 &&
        progress.eligibleCount === 4 &&
        Object.keys(progress).join() === 'submittedCount,eligibleCount',
    ],
    [
      'no open round means no progress payload',
      shapeParticipationProgress({
        openRound: undefined,
        allRows: [completeA],
        eligibleCount: 4,
      }) === null,
    ],
    [
      'incomplete ballots are not submitted',
      submittedVoterIds(['c1', 'c2'], [completeA, incompleteB]).join() === '',
    ],
    [
      'solo no-batch below-top still needs a reason',
      isBelowTopPick(
        'c2',
        winnerScopeIds('c2', [], ['c1', 'c2']),
        { c1: 2, c2: 0 },
        undefined,
      ) === true &&
        isBelowTopPick(
          'c2',
          winnerScopeIds('c2', [], ['c1', 'c2']),
          { c1: 2, c2: 0 },
          'Fits the spoken brief',
        ) === false,
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'name-participation.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`name-participation.util ok (${checks.length})`);
}
