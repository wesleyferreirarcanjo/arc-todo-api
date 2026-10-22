import { assertVideoEditState } from './video-edit-state';
import { baseMime, isVideoFileKind } from './video-files';

if (require.main === module) {
  const valid = {
    version: 1,
    clips: [{ start: 0, end: 1000 }],
    zooms: [],
    sourceDurationMs: 1000,
  };

  const throws = (fn: () => unknown): boolean => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };

  const checks: Array<[string, boolean]> = [
    ['valid minimal state', assertVideoEditState(valid) === valid],
    [
      'version 2 throws',
      throws(() => assertVideoEditState({ ...valid, version: 2 })),
    ],
    [
      'empty clips throws',
      throws(() => assertVideoEditState({ ...valid, clips: [] })),
    ],
    [
      'oversize state throws',
      throws(() =>
        assertVideoEditState({ ...valid, padding: 'x'.repeat(500_001) }),
      ),
    ],
    ['recording kind', isVideoFileKind('recording')],
    ['evil kind', !isVideoFileKind('evil')],
    ['base mime', baseMime('video/webm;codecs=vp9') === 'video/webm'],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'video-edit-state failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log('video-edit-state checks passed');
}
