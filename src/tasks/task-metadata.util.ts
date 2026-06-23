import { BadRequestException } from '@nestjs/common';
import { TaskCategory, BUILTIN_TASK_CATEGORIES, isTaskCategory } from './task-category.enum';

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
    throw new BadRequestException(`metadata.${key} must be a string`);
  }
  if (value.length > maxLen) {
    throw new BadRequestException(
      `metadata.${key} exceeds maximum length of ${maxLen}`,
    );
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
    throw new BadRequestException(`metadata.${key} must be a valid http(s) URL`);
  }
}

function assertCommitsField(metadata: Record<string, unknown>): void {
  const value = metadata.commits;
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException('metadata.commits must be an array of strings');
  }
  if (value.length > MAX_COMMITS) {
    throw new BadRequestException(
      `metadata.commits exceeds maximum of ${MAX_COMMITS} entries`,
    );
  }
  for (const commit of value) {
    if (typeof commit !== 'string' || commit.length === 0) {
      throw new BadRequestException(
        'metadata.commits must contain non-empty strings',
      );
    }
    if (commit.length > MAX_COMMIT_LEN) {
      throw new BadRequestException(
        `metadata.commits entries exceed maximum length of ${MAX_COMMIT_LEN}`,
      );
    }
  }
}

function validateCodingMetadata(metadata: Record<string, unknown>): void {
  const allowed = new Set<string>(CODING_METADATA_KEYS);
  for (const key of Object.keys(metadata)) {
    if (!allowed.has(key)) {
      throw new BadRequestException(`Unknown coding metadata field: ${key}`);
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
    throw new BadRequestException(
      `category must be one of: ${BUILTIN_TASK_CATEGORIES.join(', ')}`,
    );
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
    throw new BadRequestException('metadata must be a JSON object');
  }
  const record = metadata as Record<string, unknown>;
  const serialized = JSON.stringify(record);
  if (serialized.length > MAX_METADATA_BYTES) {
    throw new BadRequestException('metadata exceeds maximum size');
  }

  if (category === 'coding') {
    validateCodingMetadata(record);
  } else if (Object.keys(record).length > 0) {
    throw new BadRequestException(
      `metadata is only supported for coding tasks today`,
    );
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
