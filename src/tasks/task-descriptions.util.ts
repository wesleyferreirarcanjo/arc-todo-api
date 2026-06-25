export interface TaskDescriptionFields {
  description: string | null;
  businessDescription: string | null;
  planCodeDescription: string | null;
  testDescription: string | null;
}

export interface TaskDescriptionInput {
  description?: string;
  businessDescription?: string;
  planCodeDescription?: string;
  testDescription?: string;
}

function normalize(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function resolveBusinessDescription(
  input: TaskDescriptionInput,
  current: string | null = null,
): string | null {
  if (input.businessDescription !== undefined) {
    return normalize(input.businessDescription);
  }
  if (input.description !== undefined) {
    return normalize(input.description);
  }
  return current;
}

export function resolveDescriptionFields(
  input: TaskDescriptionInput,
  current: TaskDescriptionFields,
): TaskDescriptionFields {
  const businessDescription = resolveBusinessDescription(input, current.businessDescription);

  return {
    businessDescription,
    planCodeDescription:
      input.planCodeDescription !== undefined
        ? normalize(input.planCodeDescription)
        : current.planCodeDescription,
    testDescription:
      input.testDescription !== undefined
        ? normalize(input.testDescription)
        : current.testDescription,
    description: businessDescription,
  };
}

export function toDescriptionResponse(task: {
  description: string | null;
  businessDescription?: string | null;
  planCodeDescription?: string | null;
  testDescription?: string | null;
}): TaskDescriptionFields {
  const businessDescription =
    normalize(task.businessDescription) ?? normalize(task.description);

  return {
    businessDescription,
    planCodeDescription: normalize(task.planCodeDescription),
    testDescription: normalize(task.testDescription),
    description: businessDescription,
  };
}

if (require.main === module) {
  const resolved = resolveDescriptionFields(
    { description: 'legacy text', planCodeDescription: ' plan ' },
    {
      description: 'old',
      businessDescription: 'old',
      planCodeDescription: null,
      testDescription: null,
    },
  );
  console.assert(
    resolved.businessDescription === 'legacy text',
    'expected legacy description alias',
  );
  console.assert(resolved.planCodeDescription === 'plan', 'expected trimmed plan');
}
