export function projectAcronymCandidates(name: string): string[] {
  const letters = name.toLowerCase().replace(/[^a-z]/g, '');
  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (value: string) => {
    const code = value.slice(0, 3);
    if (code.length === 3 && !seen.has(code)) {
      seen.add(code);
      candidates.push(code);
    }
  };

  if (letters.length >= 3) {
    add(letters.slice(0, 3));
    for (let i = 0; i < letters.length; i++) {
      for (let j = i + 1; j < letters.length; j++) {
        for (let k = j + 1; k < letters.length; k++) {
          add(letters[i] + letters[j] + letters[k]);
        }
      }
    }
    for (let i = 1; i <= letters.length - 3; i++) {
      add(letters.slice(i, i + 3));
    }
  }

  // ponytail: pad short names and fall back to deterministic codes if combos are exhausted
  const base = (letters.slice(0, 2) || 'pr').padEnd(2, 'x');
  for (let n = 0; n < 1000; n++) {
    add(base + n.toString(36).slice(-1));
  }

  return candidates;
}

export function pickUniqueProjectAcronym(
  name: string,
  used: ReadonlySet<string>,
): string {
  for (const candidate of projectAcronymCandidates(name)) {
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Unable to allocate acronym for project: ${name}`);
}

export async function ensureUniqueProjectAcronym(
  name: string,
  exists: (acronym: string) => Promise<boolean>,
): Promise<string> {
  for (const candidate of projectAcronymCandidates(name)) {
    if (!(await exists(candidate))) {
      return candidate;
    }
  }
  throw new Error(`Unable to allocate acronym for project: ${name}`);
}

export function formatTaskDisplayId(acronym: string, taskNumber: number): string {
  return `#${acronym}-${taskNumber}`;
}

export function parseTaskDisplayId(
  identifier: string,
): { acronym: string; taskNumber: number } | null {
  const normalized = identifier.trim().replace(/^#/, '');
  const match = /^([a-z]{3})-(\d+)$/i.exec(normalized);
  if (!match) {
    return null;
  }
  return {
    acronym: match[1].toLowerCase(),
    taskNumber: parseInt(match[2], 10),
  };
}

if (require.main === module) {
  const used = new Set<string>();
  const arcTodo = pickUniqueProjectAcronym('arc-todo', used);
  used.add(arcTodo);
  const arcShip = pickUniqueProjectAcronym('arc-ship', used);
  console.assert(arcTodo === 'arc', `expected arc, got ${arcTodo}`);
  console.assert(arcShip === 'ars', `expected ars, got ${arcShip}`);
  console.assert(
    parseTaskDisplayId('#arc-1')?.taskNumber === 1,
    'parseTaskDisplayId failed',
  );
  if (arcTodo !== 'arc' || arcShip !== 'ars') {
    throw new Error('acronym.util self-check failed');
  }
  console.log('acronym.util self-check passed');
}
