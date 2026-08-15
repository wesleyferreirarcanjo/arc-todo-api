import { appError } from '../errors/app-errors';
import { TaskCategory, isTaskCategory } from './task-category.enum';

export const CODING_METADATA_KEYS = [
  'repositoryUrl',
  'branch',
  'commits',
  'pullRequestUrl',
  'deploymentUrl',
  'implementationNotes',
] as const;

const MAX_URL_LEN = 2048;
const MAX_BRANCH_LEN = 256;
const MAX_NOTE_LEN = 10000;
const MAX_COMMITS = 20;
const MAX_COMMIT_LEN = 64;
const MAX_METADATA_BYTES = 16384;

function assertStringField(
  metadata: Record<string, unknown>,
  key: string,
  maxLen: number,
): void {
  const value = metadata[key];
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    throw appError('META_FIELD_TYPE');
  }
  if (value.length > maxLen) {
    throw appError('META_FIELD_LENGTH');
  }
}

function assertUrlField(
  metadata: Record<string, unknown>,
  key: string,
): void {
  assertStringField(metadata, key, MAX_URL_LEN);
  const value = metadata[key];
  if (value === undefined || value === '') {
    return;
  }
  try {
    const parsed = new URL(value as string);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
  } catch {
    throw appError('META_URL');
  }
}

function assertCommitsField(metadata: Record<string, unknown>): void {
  const value = metadata.commits;
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    throw appError('META_COMMITS_TYPE');
  }
  if (value.length > MAX_COMMITS) {
    throw appError('META_COMMITS_COUNT');
  }
  for (const commit of value) {
    if (typeof commit !== 'string' || commit.length === 0) {
      throw appError('META_COMMITS_EMPTY');
    }
    if (commit.length > MAX_COMMIT_LEN) {
      throw appError('META_COMMITS_LENGTH');
    }
  }
}

function validateCodingMetadata(metadata: Record<string, unknown>): void {
  const allowed = new Set<string>(CODING_METADATA_KEYS);
  for (const key of Object.keys(metadata)) {
    if (!allowed.has(key)) {
      throw appError('META_UNKNOWN_FIELD');
    }
  }
  assertUrlField(metadata, 'repositoryUrl');
  assertStringField(metadata, 'branch', MAX_BRANCH_LEN);
  assertCommitsField(metadata);
  assertUrlField(metadata, 'pullRequestUrl');
  assertUrlField(metadata, 'deploymentUrl');
  assertStringField(metadata, 'implementationNotes', MAX_NOTE_LEN);
}

export function assertTaskCategory(category: string): asserts category is TaskCategory {
  if (!isTaskCategory(category)) {
    throw appError('META_CATEGORY');
  }
}

export function normalizeTaskMetadata(
  category: TaskCategory,
  metadata: unknown,
): Record<string, unknown> {
  if (metadata === undefined || metadata === null) {
    return {};
  }
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw appError('META_OBJECT');
  }
  const record = metadata as Record<string, unknown>;
  const serialized = JSON.stringify(record);
  if (serialized.length > MAX_METADATA_BYTES) {
    throw appError('META_SIZE');
  }

  if (category === 'coding') {
    validateCodingMetadata(record);
  } else if (Object.keys(record).length > 0) {
    throw appError('META_CODING_ONLY');
  }

  return record;
}

if (require.main === module) {
  const coding = normalizeTaskMetadata('coding', {
    repositoryUrl: 'https://github.com/example/repo',
    branch: 'main',
    commits: ['abc123'],
    pullRequestUrl: 'https://github.com/example/repo/pull/1',
    deploymentUrl: 'https://app.example.com',
    implementationNotes: 'Ship it',
  });
  if (coding.branch !== 'main') {
    throw new Error('expected branch main');
  }

  let rejected = false;
  try {
    normalizeTaskMetadata('meeting', { room: 'A' });
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error('expected meeting metadata rejection');
  }

  console.log('task-metadata.util self-check passed');
}
