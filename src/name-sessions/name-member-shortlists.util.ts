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
};

function isLikeLove(
  value: unknown,
): value is Extract<CandidateReaction, 'liked' | 'loved'> {
  return value === 'liked' || value === 'loved';
}

export function collectOtherRaterIds(
  candidates: RatedCandidate[],
  viewerId: string,
): string[] {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    for (const userId of Object.keys(asUserRatings(candidate.userRatings))) {
      if (userId && userId !== viewerId) ids.add(userId);
    }
  }
  return [...ids];
}

export function projectMemberShortlists(
  candidates: RatedCandidate[],
  viewerId: string,
  namesByUserId: Map<string, { id: string; username: string }>,
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

  for (const candidate of candidates) {
    const map = asUserRatings(candidate.userRatings);
    for (const [userId, row] of Object.entries(map)) {
      if (!userId || userId === viewerId) continue;
      const liked = isLikeLove(row.reaction) ? row.reaction : null;
      const overall = isOverallScore(row.overall) ? row.overall : null;
      if (!liked && overall === null) continue;
      const member = ensure(userId);
      if (liked) {
        member.likedLoved.push({
          candidateId: candidate.id,
          name: candidate.name,
          reaction: liked,
        });
      }
      if (overall !== null) {
        const notes =
          typeof row.notes === 'string' && row.notes.trim()
            ? row.notes
            : undefined;
        member.ratings.push({
          candidateId: candidate.id,
          name: candidate.name,
          overall,
          ...(notes ? { notes } : {}),
        });
      }
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
  ]);
  const view = projectMemberShortlists(candidates, alice, names);
  const bobRow = view.find((row) => row.userId === bob);
  const caraRow = view.find((row) => row.userId === cara);
  const empty = projectMemberShortlists(candidates, alice, names).every(
    (row) => row.userId !== alice,
  );
  const serialized = JSON.stringify(view);
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
