export type UserRating = {
  overall?: number;
  notes?: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isOverallScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function asUserRatings(value: unknown): Record<string, UserRating> {
  if (!isRecord(value)) return {};
  const out: Record<string, UserRating> = {};
  for (const [userId, row] of Object.entries(value)) {
    if (!userId || !isRecord(row)) continue;
    const overall = row.overall;
    const notes = row.notes;
    const updatedAt = row.updatedAt;
    out[userId] = {
      ...(isOverallScore(overall) ? { overall } : {}),
      ...(typeof notes === 'string' ? { notes } : {}),
      updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
    };
  }
  return out;
}

export function upsertUserRating(
  map: Record<string, UserRating>,
  userId: string,
  patch: { overall?: number; notes?: string },
  at: string,
): Record<string, UserRating> {
  const prev = map[userId] ?? { updatedAt: at };
  return {
    ...map,
    [userId]: {
      ...prev,
      ...(patch.overall !== undefined ? { overall: patch.overall } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      updatedAt: at,
    },
  };
}

export function mergeIncomingCandidates<
  T extends Record<string, unknown> & { id: string; name: string },
>(
  stored: T[],
  incoming: unknown[],
  userId: string,
  newId: () => string,
  at: string,
): T[] {
  const existingById = new Map(stored.map((item) => [item.id, item]));
  return incoming
    .filter(
      (item): item is T =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as T).name === 'string',
    )
    .map((item) => {
      const id = typeof item.id === 'string' && item.id ? item.id : newId();
      const prev = existingById.get(id);
      const { userRatings: _ignored, ...rest } = item;
      const ratings = rest.ratings;
      const ratingRecord =
        ratings && typeof ratings === 'object' && !Array.isArray(ratings)
          ? (ratings as Record<string, unknown>)
          : {};
      let nextRatings = asUserRatings(prev?.userRatings);
      const overall = ratingRecord.overall;
      const notes = typeof rest.notes === 'string' ? rest.notes : undefined;
      if (isOverallScore(overall) || notes !== undefined) {
        nextRatings = upsertUserRating(
          nextRatings,
          userId,
          {
            ...(isOverallScore(overall) ? { overall } : {}),
            ...(notes !== undefined ? { notes } : {}),
          },
          at,
        );
      }
      return {
        ...rest,
        id,
        name: String(item.name).trim(),
        userRatings: nextRatings,
      } as unknown as T;
    })
    .filter((item) => item.name);
}

export function projectMyRating<T extends Record<string, unknown>>(
  candidate: T,
  userId: string,
): T {
  const map = asUserRatings(candidate.userRatings);
  const mine = map[userId];
  const hasAny = Object.keys(map).length > 0;
  const ratings = isRecord(candidate.ratings) ? { ...candidate.ratings } : {};
  const legacyOverall = isOverallScore(ratings.overall)
    ? ratings.overall
    : undefined;
  const legacyNotes = typeof candidate.notes === 'string' ? candidate.notes : '';
  const overall = mine?.overall ?? (hasAny ? undefined : legacyOverall);
  const notes = mine?.notes ?? (hasAny ? '' : legacyNotes);
  const nextRatings = { ...ratings };
  if (overall !== undefined) {
    nextRatings.overall = overall;
  } else {
    delete nextRatings.overall;
  }
  const { userRatings: _omit, ...rest } = candidate;
  return {
    ...rest,
    ratings: nextRatings,
    notes,
  } as unknown as T;
}

if (require.main === module) {
  const alice = 'user-a';
  const bob = 'user-b';
  const stored = {
    id: 'n1',
    name: 'Nova',
    notes: 'Shared leftover',
    ratings: { overall: 8, memorable: 4 },
    userRatings: {
      [alice]: { overall: 9, notes: 'Alice note', updatedAt: '2026-09-03' },
    },
  };
  const aliceView = projectMyRating(stored, alice);
  const bobView = projectMyRating(stored, bob);
  const legacyView = projectMyRating(
    { id: 'n2', name: 'Rift', notes: 'Old', ratings: { overall: 6 } },
    bob,
  );
  const merged = upsertUserRating({}, bob, { overall: 7, notes: 'Bob' }, 'now');
  const patched = mergeIncomingCandidates(
    [stored],
    [{ id: 'n1', name: 'Nova', notes: 'Bob note', ratings: { overall: 4 } }],
    bob,
    () => 'x',
    'now',
  )[0];
  const checks: Array<[string, boolean]> = [
    ['alice sees her score', aliceView.ratings.overall === 9],
    ['alice sees her note', aliceView.notes === 'Alice note'],
    ['alice view hides the map', !('userRatings' in aliceView)],
    ['bob does not inherit alice score', bobView.ratings.overall === undefined],
    ['bob empty note when others have rated', bobView.notes === ''],
    ['legacy shared score until anyone rates', legacyView.ratings.overall === 6],
    ['legacy shared notes until anyone rates', legacyView.notes === 'Old'],
    ['upsert writes this user only', merged[bob]?.overall === 7],
    ['patch keeps alice and writes bob', asUserRatings(patched.userRatings)[alice]?.overall === 9 && asUserRatings(patched.userRatings)[bob]?.overall === 4],
    ['overall 11 rejected', isOverallScore(11) === false],
    ['overall 0 rejected', isOverallScore(0) === false],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'name-user-rating.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`name-user-rating.util ok (${checks.length})`);
}
