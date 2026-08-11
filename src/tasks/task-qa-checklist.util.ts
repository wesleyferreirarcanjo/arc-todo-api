/** Snapshot of a task created from a Melhoria QA action. */
export interface QaImprovementTaskRef {
  id: string;
  displayId: string;
}

export interface QaChecklistState {
  checkedItemIds: string[];
  buggedItemIds: string[];
  /** Per-item bug notes keyed by checklist item id — one or more reasons each. */
  buggedItemNotes: Record<string, string[]>;
  /** Task-level Melhoria generations (standalone sibling tasks). */
  improvementTasks: QaImprovementTaskRef[];
  /** Per-checklist-item Melhoria generations keyed by item id. */
  improvementItemTasks: Record<string, QaImprovementTaskRef[]>;
}

export interface QaChecklistItem {
  id: string;
  label: string;
}

export interface QaChecklistProgress {
  done: number;
  total: number;
}

const EMPTY_STATE: QaChecklistState = {
  checkedItemIds: [],
  buggedItemIds: [],
  buggedItemNotes: {},
  improvementTasks: [],
  improvementItemTasks: {},
};

const MAX_IMPROVEMENT_REFS = 50;

const CHECKLIST_SECTION_TITLE = 'o que verificar';

const KNOWN_PLAIN_SECTION_TITLES = new Set([
  'onde testar',
  'o que verificar',
  'como executar',
  'resultado esperado',
]);

interface ParsedSection {
  title: string | null;
  lines: string[];
}

function normalizeImprovementTaskRef(
  value: unknown,
): QaImprovementTaskRef | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { id?: unknown; displayId?: unknown };
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.displayId !== 'string' || !raw.displayId.trim()) return null;
  return { id: raw.id.trim(), displayId: raw.displayId.trim() };
}

function normalizeImprovementTaskRefs(value: unknown): QaImprovementTaskRef[] {
  if (!Array.isArray(value)) return [];
  const refs: QaImprovementTaskRef[] = [];
  for (const entry of value) {
    const ref = normalizeImprovementTaskRef(entry);
    if (ref) refs.push(ref);
  }
  return refs.slice(0, MAX_IMPROVEMENT_REFS);
}

export function normalizeQaChecklistState(
  value: unknown,
): QaChecklistState {
  if (!value || typeof value !== 'object') {
    return {
      ...EMPTY_STATE,
      buggedItemNotes: {},
      improvementItemTasks: {},
    };
  }

  const raw = value as {
    checkedItemIds?: unknown;
    buggedItemIds?: unknown;
    buggedItemNotes?: unknown;
    improvementTasks?: unknown;
    improvementItemTasks?: unknown;
  };

  const checkedItemIds = Array.isArray(raw.checkedItemIds)
    ? raw.checkedItemIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map((id) => id.trim())
        .slice(0, 500)
    : [];

  const buggedItemIds = Array.isArray(raw.buggedItemIds)
    ? raw.buggedItemIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map((id) => id.trim())
        .slice(0, 500)
    : [];

  const buggedItemNotes: Record<string, string[]> = {};
  if (raw.buggedItemNotes && typeof raw.buggedItemNotes === 'object') {
    for (const [key, note] of Object.entries(
      raw.buggedItemNotes as Record<string, unknown>,
    )) {
      if (typeof key !== 'string' || !key.trim()) continue;
      const id = key.trim();
      const list: string[] = [];
      if (typeof note === 'string') {
        const trimmed = note.trim();
        if (trimmed) list.push(trimmed);
      } else if (Array.isArray(note)) {
        for (const entry of note) {
          if (typeof entry !== 'string') continue;
          const trimmed = entry.trim();
          if (trimmed) list.push(trimmed);
        }
      }
      if (list.length > 0) {
        buggedItemNotes[id] = list.slice(0, 50);
      }
    }
  }

  // Drop notes for ids that are no longer bugged.
  const buggedSet = new Set(buggedItemIds);
  for (const key of Object.keys(buggedItemNotes)) {
    if (!buggedSet.has(key)) {
      delete buggedItemNotes[key];
    }
  }

  const improvementTasks = normalizeImprovementTaskRefs(raw.improvementTasks);

  const improvementItemTasks: Record<string, QaImprovementTaskRef[]> = {};
  if (raw.improvementItemTasks && typeof raw.improvementItemTasks === 'object') {
    for (const [key, entry] of Object.entries(
      raw.improvementItemTasks as Record<string, unknown>,
    )) {
      if (typeof key !== 'string' || !key.trim()) continue;
      const refs = normalizeImprovementTaskRefs(entry);
      if (refs.length > 0) {
        improvementItemTasks[key.trim()] = refs;
      }
    }
  }

  return {
    checkedItemIds,
    buggedItemIds,
    buggedItemNotes,
    improvementTasks,
    improvementItemTasks,
  };
}

function normalizeHeadingTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase();
}

function matchSectionHeading(line: string): string | null {
  const markdownMatch = line.match(/^#{1,6}\s+(.+)$/);
  if (markdownMatch) {
    const title = markdownMatch[1].trim();
    return title || null;
  }

  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  if (KNOWN_PLAIN_SECTION_TITLES.has(normalizeHeadingTitle(trimmed))) {
    return trimmed;
  }

  return null;
}

function parseBulletLabel(line: string): string | null {
  const checkboxMatch = line.match(/^\s*-\s*\[[ xX]\]\s*(.+)$/);
  if (checkboxMatch) {
    const label = checkboxMatch[1].trim();
    return label || null;
  }

  const bulletMatch = line.match(/^\s*-\s+(.+)$/);
  if (bulletMatch) {
    const label = bulletMatch[1].trim();
    return label || null;
  }

  return null;
}

function collectChecklistItems(lines: string[]): QaChecklistItem[] {
  const items: QaChecklistItem[] = [];
  let index = 0;

  for (const line of lines) {
    const label = parseBulletLabel(line);
    if (!label) {
      continue;
    }
    items.push({ id: `item-${index}`, label });
    index += 1;
  }

  return items;
}

function splitIntoSections(testDescription: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let current: ParsedSection = { title: null, lines: [] };

  for (const line of testDescription.split('\n')) {
    const heading = matchSectionHeading(line);
    if (heading !== null) {
      if (current.title !== null || current.lines.some((entry) => entry.trim())) {
        sections.push(current);
      }
      current = { title: heading, lines: [] };
      continue;
    }
    current.lines.push(line);
  }

  if (current.title !== null || current.lines.some((entry) => entry.trim())) {
    sections.push(current);
  }

  return sections;
}

export function parseQaChecklistItems(
  testDescription: string | null | undefined,
): QaChecklistItem[] {
  if (!testDescription?.trim()) {
    return [];
  }

  const sections = splitIntoSections(testDescription);
  const checklistSection = sections.find(
    (section) =>
      section.title !== null &&
      normalizeHeadingTitle(section.title) === CHECKLIST_SECTION_TITLE,
  );

  if (!checklistSection) {
    return collectChecklistItems(testDescription.split('\n'));
  }

  return collectChecklistItems(checklistSection.lines);
}

export function computeQaChecklistProgress(
  testDescription: string | null | undefined,
  state: QaChecklistState,
): QaChecklistProgress | null {
  const items = parseQaChecklistItems(testDescription);
  if (items.length === 0) {
    return null;
  }

  const checked = new Set(state.checkedItemIds);
  const done = items.filter((item) => checked.has(item.id)).length;
  return { done, total: items.length };
}

// ponytail: runnable self-check via npm run test:task-qa-checklist
if (require.main === module) {
  const structured = `## Onde testar
- Context bullet

## O que verificar
- [ ] A
- [ ] B

## Resultado esperado
All good.`;
  const items = parseQaChecklistItems(structured);
  console.assert(items.length === 2, 'expected two checklist items from O que verificar');
  console.assert(
    items[0]?.label === 'A' && items[1]?.label === 'B',
    'expected labels A and B',
  );
  const legacy = parseQaChecklistItems('- [ ] A\n- [ ] B');
  console.assert(legacy.length === 2, 'expected legacy two checklist items');
  const progress = computeQaChecklistProgress(structured, {
    checkedItemIds: ['item-1'],
    buggedItemIds: [],
    buggedItemNotes: {},
    improvementTasks: [],
    improvementItemTasks: {},
  });
  console.assert(
    progress?.done === 1 && progress?.total === 2,
    'expected one checked item',
  );
  const withImprovements = normalizeQaChecklistState({
    checkedItemIds: [],
    buggedItemIds: [],
    improvementTasks: [
      { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', displayId: '#arc-230' },
      { id: 'bad' },
    ],
    improvementItemTasks: {
      'item-0': [{ id: '11111111-2222-3333-4444-555555555555', displayId: '#arc-231' }],
      'item-1': 'not-an-array',
    },
  });
  console.assert(
    withImprovements.improvementTasks.length === 1 &&
      withImprovements.improvementTasks[0]?.displayId === '#arc-230',
    'expected one valid task-level improvement ref',
  );
  console.assert(
    withImprovements.improvementItemTasks['item-0']?.length === 1 &&
      withImprovements.improvementItemTasks['item-1'] === undefined,
    'expected one valid per-item improvement ref and drop of malformed',
  );
}
