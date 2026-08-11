export interface QaChecklistState {
  checkedItemIds: string[];
  buggedItemIds: string[];
  buggedItemNotes: Record<string, string>;
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
};

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

export function normalizeQaChecklistState(
  value: unknown,
): QaChecklistState {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_STATE, buggedItemNotes: {} };
  }

  const raw = value as {
    checkedItemIds?: unknown;
    buggedItemIds?: unknown;
    buggedItemNotes?: unknown;
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

  const buggedItemNotes: Record<string, string> = {};
  if (raw.buggedItemNotes && typeof raw.buggedItemNotes === 'object') {
    for (const [key, note] of Object.entries(
      raw.buggedItemNotes as Record<string, unknown>,
    )) {
      if (typeof key !== 'string' || !key.trim()) continue;
      if (typeof note !== 'string') continue;
      const trimmed = note.trim();
      if (!trimmed) continue;
      buggedItemNotes[key.trim()] = trimmed;
    }
  }

  // Drop notes for ids that are no longer bugged.
  const buggedSet = new Set(buggedItemIds);
  for (const key of Object.keys(buggedItemNotes)) {
    if (!buggedSet.has(key)) {
      delete buggedItemNotes[key];
    }
  }

  return { checkedItemIds, buggedItemIds, buggedItemNotes };
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
  });
  console.assert(
    progress?.done === 1 && progress?.total === 2,
    'expected one checked item',
  );
}
