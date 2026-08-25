export type QaEnvironment = {
  name: string;
  url: string;
  notes?: string;
};

export type QaUser = {
  label: string;
  email?: string;
  howToSignIn?: string;
  notes?: string;
};

export type QaProfilePayload = {
  environments: QaEnvironment[];
  users: QaUser[];
  notes: string | null;
};

export type EmptyQaProfile = {
  id: null;
  projectId: string;
  environments: [];
  users: [];
  notes: null;
  updatedById: null;
  createdAt: null;
  updatedAt: null;
};

export type QaNormalizeError = 'QA_INVALID_URL' | 'QA_INVALID_PROFILE';

export function emptyQaProfile(projectId: string): EmptyQaProfile {
  return {
    id: null,
    projectId,
    environments: [],
    users: [],
    notes: null,
    updatedById: null,
    createdAt: null,
    updatedAt: null,
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown): string | undefined {
  const trimmed = asTrimmed(value);
  return trimmed ? trimmed : undefined;
}

function normalizeEnvironments(
  value: unknown,
): { ok: true; value: QaEnvironment[] } | { ok: false; error: QaNormalizeError } {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'QA_INVALID_PROFILE' };
  }

  const environments: QaEnvironment[] = [];
  for (const item of value) {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'QA_INVALID_PROFILE' };
    }
    const rec = item as Record<string, unknown>;
    const name = asTrimmed(rec.name);
    const url = asTrimmed(rec.url);
    const notes = optionalText(rec.notes);
    if (!name && !url && !notes) {
      continue;
    }
    if (!name) {
      return { ok: false, error: 'QA_INVALID_PROFILE' };
    }
    if (!isHttpUrl(url)) {
      return { ok: false, error: 'QA_INVALID_URL' };
    }
    const environment: QaEnvironment = { name, url };
    if (notes) {
      environment.notes = notes;
    }
    environments.push(environment);
  }
  return { ok: true, value: environments };
}

function normalizeUsers(
  value: unknown,
): { ok: true; value: QaUser[] } | { ok: false; error: QaNormalizeError } {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'QA_INVALID_PROFILE' };
  }

  const users: QaUser[] = [];
  for (const item of value) {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'QA_INVALID_PROFILE' };
    }
    const rec = item as Record<string, unknown>;
    const label = asTrimmed(rec.label);
    const email = optionalText(rec.email);
    const howToSignIn =
      optionalText(rec.howToSignIn) ?? optionalText(rec.how_to_sign_in);
    const notes = optionalText(rec.notes);
    if (!label && !email && !howToSignIn && !notes) {
      continue;
    }
    if (!label) {
      return { ok: false, error: 'QA_INVALID_PROFILE' };
    }
    const user: QaUser = { label };
    if (email) {
      user.email = email;
    }
    if (howToSignIn) {
      user.howToSignIn = howToSignIn;
    }
    if (notes) {
      user.notes = notes;
    }
    users.push(user);
  }
  return { ok: true, value: users };
}

export function normalizeQaProfile(input: {
  environments?: unknown;
  users?: unknown;
  notes?: unknown;
}):
  | { ok: true; value: QaProfilePayload }
  | { ok: false; error: QaNormalizeError } {
  const environmentsResult = normalizeEnvironments(input.environments ?? []);
  if (!environmentsResult.ok) {
    return environmentsResult;
  }
  const usersResult = normalizeUsers(input.users ?? []);
  if (!usersResult.ok) {
    return usersResult;
  }

  let notes: string | null = null;
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string') {
      return { ok: false, error: 'QA_INVALID_PROFILE' };
    }
    const trimmed = input.notes.trim();
    notes = trimmed ? trimmed : null;
  }

  return {
    ok: true,
    value: {
      environments: environmentsResult.value,
      users: usersResult.value,
      notes,
    },
  };
}

if (require.main === module) {
  const good = normalizeQaProfile({
    environments: [
      { name: 'Staging', url: 'https://example.com', extra: 'drop' },
      { name: '', url: '' },
    ],
    users: [
      {
        label: 'Member',
        email: 'a@example.com',
        how_to_sign_in: 'Google',
        password: 'secret',
      },
    ],
    notes: '  keep me  ',
  });
  const badUrl = normalizeQaProfile({
    environments: [{ name: 'Bad', url: 'nao-e-um-site' }],
  });
  const notArray = normalizeQaProfile({ environments: {} });
  const unnamed = normalizeQaProfile({
    environments: [{ name: '', url: 'https://example.com' }],
  });
  const passwordDropped =
    good.ok &&
    !('password' in (good.value.users[0] as Record<string, unknown>)) &&
    good.value.users[0].howToSignIn === 'Google';

  const checks: Array<[string, boolean]> = [
    ['https ok', isHttpUrl('https://example.com')],
    ['http ok', isHttpUrl('http://localhost:5173')],
    ['reject junk', !isHttpUrl('nao-e-um-site')],
    ['reject javascript', !isHttpUrl('javascript:alert(1)')],
    ['skip blank env', good.ok && good.value.environments.length === 1],
    ['strip extra keys', good.ok && good.value.environments[0].name === 'Staging'],
    ['notes trim', good.ok && good.value.notes === 'keep me'],
    ['how_to_sign_in', passwordDropped],
    ['no password stored', passwordDropped],
    ['bad url', !badUrl.ok && badUrl.error === 'QA_INVALID_URL'],
    ['not array', !notArray.ok && notArray.error === 'QA_INVALID_PROFILE'],
    ['unnamed url', !unnamed.ok && unnamed.error === 'QA_INVALID_PROFILE'],
    [
      'empty profile',
      emptyQaProfile('p1').environments.length === 0 &&
        emptyQaProfile('p1').notes === null,
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'qa-info.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`qa-info.util ok (${checks.length})`);
}
