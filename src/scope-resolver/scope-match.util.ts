export interface ScopeMatchItem {
  id: string;
  labels: string[];
}

export interface ScopeMatchCandidate<T extends ScopeMatchItem> {
  item: T;
  score: number;
  exact: boolean;
}

const FUZZY_THRESHOLD = 40;
// ponytail: in-memory normalized substring/prefix scoring; upgrade path is DB trigram/full-text search

export function normalizeScopeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function projectHintVariants(hint: string | undefined): string[] {
  if (!hint?.trim()) {
    return [];
  }

  const variants = [hint.trim()];
  const lower = hint.toLowerCase();
  if (lower.startsWith('my ')) {
    const stripped = hint.slice(3).trim();
    if (stripped) {
      variants.push(stripped);
    }
  }
  return [...new Set(variants)];
}

function scoreLabelMatch(hintNorm: string, labelNorm: string): number {
  if (!hintNorm || !labelNorm) {
    return 0;
  }
  if (hintNorm === labelNorm) {
    return 100;
  }
  if (hintNorm.includes(labelNorm) || labelNorm.includes(hintNorm)) {
    return 70 + Math.min(hintNorm.length, labelNorm.length);
  }

  let prefix = 0;
  for (let index = 0; index < hintNorm.length && index < labelNorm.length; index += 1) {
    if (hintNorm[index] !== labelNorm[index]) {
      break;
    }
    prefix += 1;
  }
  return prefix >= 4 ? 40 + prefix : 0;
}

export function matchScopeCandidates<T extends ScopeMatchItem>(
  items: T[],
  hint: string | undefined,
): ScopeMatchCandidate<T>[] {
  if (!hint?.trim()) {
    return [];
  }

  const hintNorm = normalizeScopeName(hint);
  if (!hintNorm) {
    return [];
  }

  const candidates: ScopeMatchCandidate<T>[] = [];
  for (const item of items) {
    let bestScore = 0;
    let exact = false;
    for (const label of item.labels) {
      const labelNorm = normalizeScopeName(label);
      if (!labelNorm) {
        continue;
      }
      if (hintNorm === labelNorm) {
        bestScore = 100;
        exact = true;
        break;
      }
      bestScore = Math.max(bestScore, scoreLabelMatch(hintNorm, labelNorm));
    }
    if (bestScore >= FUZZY_THRESHOLD) {
      candidates.push({ item, score: bestScore, exact });
    }
  }

  return candidates.sort((left, right) => right.score - left.score);
}

export function matchProjectFromMessage<T extends ScopeMatchItem>(
  message: string | undefined,
  items: T[],
): ScopeMatchCandidate<T>[] {
  if (!message?.trim()) {
    return [];
  }

  const messageNorm = normalizeScopeName(message);
  const candidates: ScopeMatchCandidate<T>[] = [];
  for (const item of items) {
    for (const label of item.labels) {
      const labelNorm = normalizeScopeName(label);
      if (labelNorm.length >= 4 && messageNorm.includes(labelNorm)) {
        candidates.push({
          item,
          score: 60 + labelNorm.length,
          exact: false,
        });
        break;
      }
    }
  }

  return candidates.sort((left, right) => right.score - left.score);
}

export function pickUniqueCandidate<T extends ScopeMatchItem>(
  candidates: ScopeMatchCandidate<T>[],
): T | null {
  if (candidates.length === 1) {
    return candidates[0].item;
  }

  const exactMatches = candidates.filter((candidate) => candidate.exact);
  if (exactMatches.length === 1) {
    return exactMatches[0].item;
  }

  const topScore = candidates[0]?.score ?? 0;
  const topCandidates = candidates.filter((candidate) => candidate.score === topScore);
  if (topCandidates.length === 1) {
    return topCandidates[0].item;
  }

  return null;
}

export function selfCheckScopeMatch(): void {
  const orgs = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      labels: ['Arc Todo', 'arc-todo'],
    },
  ];
  const projects = [
    {
      id: '22222222-2222-4222-8222-222222222222',
      labels: ['My System'],
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      labels: ['My System'],
    },
  ];

  const resolvedOrg = pickUniqueCandidate(matchScopeCandidates(orgs, 'arc-todo'));
  if (resolvedOrg?.id !== orgs[0].id) {
    throw new Error('expected exact org slug match');
  }

  const uniqueProject = pickUniqueCandidate(
    matchScopeCandidates([projects[0]], 'my system'),
  );
  if (uniqueProject?.id !== projects[0].id) {
    throw new Error('expected fuzzy project match');
  }

  const ambiguous = pickUniqueCandidate(matchScopeCandidates(projects, 'my system'));
  if (ambiguous !== null) {
    throw new Error('expected ambiguous project match');
  }
}

if (require.main === module) {
  selfCheckScopeMatch();
  console.log('scope-match self-check passed');
}
