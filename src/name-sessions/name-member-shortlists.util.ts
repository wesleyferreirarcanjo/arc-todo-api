import {
  asUserRatings,
  isOverallScore,
  type CandidateReaction,
} from './name-user-rating.util';

export type MemberShortlistLiked = {
  candidateId: string;
  name: string;
  reaction: Extract<CandidateReaction, 'liked' | 'loved'>;
};

export type MemberShortlistRating = {
  candidateId: string;
  name: string;
  overall: number;
  notes?: string;
};

export type MemberShortlistView = {
  userId: string;
  displayName: string;
  likedLoved: MemberShortlistLiked[];
  ratings: MemberShortlistRating[];
};

type RatedCandidate = {
  id: string;
  name: string;
  userRatings?: unknown;
  reaction?: unknown;
  ratings?: unknown;
  notes?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isLikeLove(
  value: unknown,
): value is Extract<CandidateReaction, 'liked' | 'loved'> {
  return value === 'liked' || value === 'loved';
}

function coerceReaction(value: unknown): CandidateReaction | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'liked' ||
    normalized === 'loved' ||
    normalized === 'passed'
  ) {
    return normalized;
  }
  return null;
}

function coerceOverall(value: unknown): number | null {
  if (isOverallScore(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (isOverallScore(parsed)) return parsed;
  }
  return null;
}

function coerceNotes(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** GET leftover on stored JSON when merge never copied Like/Love into userRatings. */
function leftoverPublicRating(candidate: RatedCandidate): {
  liked: Extract<CandidateReaction, 'liked' | 'loved'> | null;
  overall: number | null;
  notes?: string;
} {
  const reaction = coerceReaction(candidate.reaction);
  const ratings = isRecord(candidate.ratings) ? candidate.ratings : {};
  return {
    liked: isLikeLove(reaction) ? reaction : null,
    overall: coerceOverall(ratings.overall),
    notes: coerceNotes(candidate.notes),
  };
}

function rawRatingRows(
  value: unknown,
): Array<[string, Record<string, unknown>]> {
  const canonical = asUserRatings(value);
  const rows = new Map<string, Record<string, unknown>>();
  for (const [userId, row] of Object.entries(canonical)) {
    rows.set(userId, { ...row });
  }
  if (!isRecord(value)) return [...rows.entries()];
  for (const [userId, row] of Object.entries(value)) {
    if (!userId) continue;
    if (typeof row === 'string') {
      const existing = rows.get(userId) ?? {};
      if (!existing.reaction) existing.reaction = row;
      rows.set(userId, existing);
      continue;
    }
    if (!isRecord(row)) continue;
    const existing = rows.get(userId) ?? {};
    rows.set(userId, { ...row, ...existing });
  }
  return [...rows.entries()];
}

export function collectOtherRaterIds(
  candidates: RatedCandidate[],
  viewerId: string,
): string[] {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    for (const [userId] of rawRatingRows(candidate.userRatings)) {
      if (userId && userId !== viewerId) ids.add(userId);
    }
  }
  return [...ids];
}

export function projectMemberShortlists(
  candidates: RatedCandidate[],
  viewerId: string,
  namesByUserId: Map<string, { id: string; username: string }>,
  fallbackUserId?: string,
): MemberShortlistView[] {
  const byUser = new Map<string, MemberShortlistView>();

  const ensure = (userId: string): MemberShortlistView => {
    const existing = byUser.get(userId);
    if (existing) return existing;
    const username = namesByUserId.get(userId)?.username?.trim();
    const created: MemberShortlistView = {
      userId,
      displayName: username || 'Member',
      likedLoved: [],
      ratings: [],
    };
    byUser.set(userId, created);
    return created;
  };

  const pushLiked = (
    userId: string,
    candidate: RatedCandidate,
    reaction: Extract<CandidateReaction, 'liked' | 'loved'>,
  ) => {
    const member = ensure(userId);
    if (member.likedLoved.some((item) => item.candidateId === candidate.id)) {
      return;
    }
    member.likedLoved.push({
      candidateId: candidate.id,
      name: candidate.name,
      reaction,
    });
  };

  const pushRating = (
    userId: string,
    candidate: RatedCandidate,
    overall: number,
    notes?: string,
  ) => {
    const member = ensure(userId);
    if (member.ratings.some((item) => item.candidateId === candidate.id)) {
      return;
    }
    member.ratings.push({
      candidateId: candidate.id,
      name: candidate.name,
      overall,
      ...(notes ? { notes } : {}),
    });
  };

  for (const candidate of candidates) {
    const rows = rawRatingRows(candidate.userRatings);
    const otherRowIds = rows
      .map(([userId]) => userId)
      .filter((userId) => userId && userId !== viewerId);
    let attributedLike = false;
    let attributedOverall = false;

    for (const [userId, row] of rows) {
      if (!userId || userId === viewerId) continue;
      const reaction = coerceReaction(row.reaction);
      if (reaction === 'passed' && coerceOverall(row.overall) === null) continue;
      const liked = isLikeLove(reaction)
        ? reaction
        : row.favorited === true
          ? 'liked'
          : null;
      const overall = coerceOverall(row.overall);
      if (!liked && overall === null) continue;
      if (liked) {
        pushLiked(userId, candidate, liked);
        attributedLike = true;
      }
      if (overall !== null) {
        pushRating(userId, candidate, overall, coerceNotes(row.notes));
        attributedOverall = true;
      }
    }

    const leftover = leftoverPublicRating(candidate);
    const leftoverOwner =
      fallbackUserId &&
      fallbackUserId !== viewerId &&
      otherRowIds.length === 0
        ? fallbackUserId
        : null;
    if (leftoverOwner && leftover.liked && !attributedLike) {
      pushLiked(leftoverOwner, candidate, leftover.liked);
    }
    if (leftoverOwner && leftover.overall !== null && !attributedOverall) {
      pushRating(
        leftoverOwner,
        candidate,
        leftover.overall,
        leftover.notes,
      );
    }
  }

  return [...byUser.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

if (require.main === module) {
  const alice = 'user-a';
  const bob = 'user-b';
  const cara = 'user-c';
  const dave = 'user-d';
  const candidates: RatedCandidate[] = [
    {
      id: 'n1',
      name: 'Nova',
      userRatings: {
        [alice]: {
          overall: 9,
          notes: 'Alice note',
          reaction: 'loved',
          favorited: true,
          updatedAt: 't',
        },
        [bob]: {
          overall: 7,
          notes: 'Fits the product',
          reaction: 'liked',
          favorited: true,
          updatedAt: 't',
        },
        [cara]: { reaction: 'passed', favorited: true, updatedAt: 't' },
      },
    },
    {
      id: 'n2',
      name: 'Rift',
      userRatings: {
        [bob]: { reaction: 'loved', updatedAt: 't' },
      },
    },
  ];
  const names = new Map([
    [bob, { id: bob, username: 'arthura' }],
    [cara, { id: cara, username: 'cara' }],
    [dave, { id: dave, username: 'dave' }],
  ]);
  const view = projectMemberShortlists(candidates, alice, names);
  const bobRow = view.find((row) => row.userId === bob);
  const caraRow = view.find((row) => row.userId === cara);
  const empty = projectMemberShortlists(candidates, alice, names).every(
    (row) => row.userId !== alice,
  );
  const serialized = JSON.stringify(view);
  const favoritedOnly = projectMemberShortlists(
    [
      {
        id: 'n3',
        name: 'Kite',
        userRatings: {
          [dave]: { favorited: true, updatedAt: 't' },
        },
      },
    ],
    alice,
    names,
  );
  const leftover = projectMemberShortlists(
    [
      {
        id: 'n4',
        name: 'Helios',
        reaction: 'Loved',
        ratings: { overall: '8' },
        notes: '  Strong  ',
      },
    ],
    alice,
    names,
    bob,
  );
  const leftoverIgnoredWhenMapped = projectMemberShortlists(
    [
      {
        id: 'n5',
        name: 'Ply',
        reaction: 'liked',
        ratings: { overall: 3 },
        userRatings: {
          [bob]: { reaction: 'loved', overall: 9, notes: 'Bob', updatedAt: 't' },
        },
      },
    ],
    alice,
    names,
    dave,
  );
  const stringReaction = projectMemberShortlists(
    [
      {
        id: 'n6',
        name: 'Vellum',
        userRatings: {
          [bob]: 'liked',
        },
      },
    ],
    alice,
    names,
  );
  const checks: Array<[string, boolean]> = [
    ['excludes the viewer', empty && !view.some((row) => row.userId === alice)],
    ['bob displayName from members list', bobRow?.displayName === 'arthura'],
    [
      'bob likedLoved is Like then Love',
      JSON.stringify(bobRow?.likedLoved) ===
        JSON.stringify([
          { candidateId: 'n1', name: 'Nova', reaction: 'liked' },
          { candidateId: 'n2', name: 'Rift', reaction: 'loved' },
        ]),
    ],
    [
      'bob rating includes 1-10 and note',
      JSON.stringify(bobRow?.ratings) ===
        JSON.stringify([
          {
            candidateId: 'n1',
            name: 'Nova',
            overall: 7,
            notes: 'Fits the product',
          },
        ]),
    ],
    ['passed-only member omitted', caraRow === undefined],
    ['no userRatings map leaked', !serialized.includes('userRatings')],
    ['no favorited leaked', !serialized.includes('favorited')],
    ['no ballot fields leaked', !serialized.includes('rememberedSpelling')],
    [
      'ids collected exclude viewer',
      collectOtherRaterIds(candidates, alice).sort().join(',') ===
        [bob, cara].sort().join(','),
    ],
    [
      'solo-shaped call with only viewer ratings is empty',
      projectMemberShortlists(
        [
          {
            id: 'n1',
            name: 'Nova',
            userRatings: {
              [alice]: { reaction: 'loved', overall: 8, updatedAt: 't' },
            },
          },
        ],
        alice,
        names,
      ).length === 0,
    ],
    [
      'favorited-only shortlist appears as Like',
      JSON.stringify(favoritedOnly) ===
        JSON.stringify([
          {
            userId: dave,
            displayName: 'dave',
            likedLoved: [
              { candidateId: 'n3', name: 'Kite', reaction: 'liked' },
            ],
            ratings: [],
          },
        ]),
    ],
    [
      'GET leftover reaction and score go to createdBy',
      JSON.stringify(leftover) ===
        JSON.stringify([
          {
            userId: bob,
            displayName: 'arthura',
            likedLoved: [
              { candidateId: 'n4', name: 'Helios', reaction: 'loved' },
            ],
            ratings: [
              {
                candidateId: 'n4',
                name: 'Helios',
                overall: 8,
                notes: 'Strong',
              },
            ],
          },
        ]),
    ],
    [
      'mapped userRatings win over leftover GET shape',
      JSON.stringify(leftoverIgnoredWhenMapped.find((row) => row.userId === bob)) ===
        JSON.stringify({
          userId: bob,
          displayName: 'arthura',
          likedLoved: [{ candidateId: 'n5', name: 'Ply', reaction: 'loved' }],
          ratings: [
            { candidateId: 'n5', name: 'Ply', overall: 9, notes: 'Bob' },
          ],
        }) && !leftoverIgnoredWhenMapped.some((row) => row.userId === dave),
    ],
    [
      'string reaction row is Like',
      JSON.stringify(stringReaction[0]?.likedLoved) ===
        JSON.stringify([
          { candidateId: 'n6', name: 'Vellum', reaction: 'liked' },
        ]),
    ],
    [
      'empty array is empty not omitted-shaped',
      Array.isArray(
        projectMemberShortlists(
          [
            {
              id: 'n1',
              name: 'Nova',
              userRatings: {
                [alice]: { reaction: 'loved', updatedAt: 't' },
              },
            },
          ],
          alice,
          names,
        ),
      ) &&
        projectMemberShortlists(
          [
            {
              id: 'n1',
              name: 'Nova',
              userRatings: {
                [alice]: { reaction: 'loved', updatedAt: 't' },
              },
            },
          ],
          alice,
          names,
        ).length === 0,
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'name-member-shortlists.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`name-member-shortlists.util ok (${checks.length})`);
}
