/** Bytes counted in the database before an image or video may go to R2. */
export const MEDIA_QUOTA_CHECK_BYTES = 9_900_000_000;

/** Display cap shown on Storage (Cloudflare's 10 decimal GB). */
export const MEDIA_QUOTA_DISPLAY_BYTES = 10_000_000_000;

export const R2_BUCKET_DEFAULT = 'arc-todo-media';

export interface MediaCopyCandidate {
  id: string;
  sizeBytes: number;
}

export function mediaFits(usedBytes: number, incomingBytes: number): boolean {
  return usedBytes + incomingBytes < MEDIA_QUOTA_CHECK_BYTES;
}

export function nextCopy(
  candidates: readonly MediaCopyCandidate[],
  usedBytes: number,
): MediaCopyCandidate | undefined {
  return candidates.find((candidate) =>
    mediaFits(usedBytes, candidate.sizeBytes),
  );
}

if (require.main === module) {
  const checks: Array<[string, boolean]> = [
    ['100 MB at 9.8 GB is full', mediaFits(9_800_000_000, 100_000_000) === false],
    [
      'just-under 100 MB at 9.8 GB fits',
      mediaFits(9_800_000_000, 99_999_999) === true,
    ],
    [
      '100 MB MinIO file not chosen at 9.8 GB + 1',
      nextCopy([{ id: '100mb', sizeBytes: 100_000_000 }], 9_800_000_001) ===
        undefined,
    ],
    [
      'newer 1 MB chosen before older 50 MB',
      nextCopy(
        [
          { id: 'newer-1mb', sizeBytes: 1_000_000 },
          { id: 'older-50mb', sizeBytes: 50_000_000 },
        ],
        0,
      )?.id === 'newer-1mb',
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'media-quota.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`media-quota.util ok (${checks.length})`);
}
