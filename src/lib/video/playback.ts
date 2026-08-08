export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 2;

export function clampPlaybackRate(rate: number): number {
  if (Number.isNaN(rate)) return 1;
  return Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rate));
}

// When both loop points are set and valid (b > a), returns `a` once playback
// reaches or passes `b` — the caller seeks the media element there. Otherwise null.
export function loopSeekTarget(
  currentTime: number,
  a: number | null,
  b: number | null,
): number | null {
  if (a === null || b === null) return null;
  if (b <= a) return null;
  return currentTime >= b ? a : null;
}
