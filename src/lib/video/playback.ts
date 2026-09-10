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
