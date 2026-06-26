export interface QaChecklistState {
  checkedItemIds: string[];
  buggedItemIds: string[];
}

export interface QaChecklistItem {
  id: string;
  label: string;
}

export interface QaChecklistProgress {
  done: number;
  total: number;
}

const EMPTY_STATE: QaChecklistState = { checkedItemIds: [], buggedItemIds: [] };

export function normalizeQaChecklistState(
  value: unknown,
): QaChecklistState {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_STATE };
  }

  const raw = value as { checkedItemIds?: unknown; buggedItemIds?: unknown };

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

  return { checkedItemIds, buggedItemIds };
}

export function parseQaChecklistItems(
  testDescription: string | null | undefined,
): QaChecklistItem[] {
  if (!testDescription?.trim()) {
    return [];
  }

  const items: QaChecklistItem[] = [];
  let index = 0;

  for (const line of testDescription.split('\n')) {
    const checkboxMatch = line.match(/^\s*-\s*\[[ xX]\]\s*(.+)$/);
    if (checkboxMatch) {
      const label = checkboxMatch[1].trim();
      if (label) {
        items.push({ id: `item-${index}`, label });
        index += 1;
      }
      continue;
    }

    const bulletMatch = line.match(/^\s*-\s+(.+)$/);
    if (bulletMatch) {
      const label = bulletMatch[1].trim();
      if (label) {
        items.push({ id: `item-${index}`, label });
        index += 1;
      }
    }
  }

  return items;
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
  const items = parseQaChecklistItems('- [ ] A\n- [ ] B');
  console.assert(items.length === 2, 'expected two checklist items');
  const progress = computeQaChecklistProgress('- [ ] A\n- [ ] B', {
    checkedItemIds: ['item-1'],
    buggedItemIds: [],
  });
  console.assert(
    progress?.done === 1 && progress?.total === 2,
    'expected one checked item',
  );
}
