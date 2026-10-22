export const VIDEO_EDIT_STATE_MAX_CHARS = 500_000;

const MAX_CLIPS = 500;
const MAX_ZOOMS = 500;

/**
 * Structural guard only: the web owns clip semantics.
 * Throws a plain Error; the service maps it to VIDEO_INVALID_EDIT_STATE.
 */
export function assertVideoEditState(
  value: unknown,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('edit state must be an object');
  }
  const state = value as Record<string, unknown>;
  if (state.version !== 1) {
    throw new Error('edit state version must be 1');
  }
  if (
    !Array.isArray(state.clips) ||
    state.clips.length < 1 ||
    state.clips.length > MAX_CLIPS
  ) {
    throw new Error(`edit state clips must be 1 to ${MAX_CLIPS} items`);
  }
  if (!Array.isArray(state.zooms) || state.zooms.length > MAX_ZOOMS) {
    throw new Error(`edit state zooms must be at most ${MAX_ZOOMS} items`);
  }
  if (
    typeof state.sourceDurationMs !== 'number' ||
    !(state.sourceDurationMs > 0)
  ) {
    throw new Error('edit state sourceDurationMs must be a positive number');
  }
  if (JSON.stringify(state).length > VIDEO_EDIT_STATE_MAX_CHARS) {
    throw new Error(
      `edit state must be at most ${VIDEO_EDIT_STATE_MAX_CHARS} characters`,
    );
  }
  return state;
}
