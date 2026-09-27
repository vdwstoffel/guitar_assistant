/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its model types only through namespaces that cannot be
 * imported as types across the bundle boundary. These `any`s are the interop
 * boundary with that untyped surface.
 */

/**
 * Whether a bar already holds as much music as its time signature allows.
 *
 * Measured in alphaTab's own playback ticks rather than by counting beats,
 * so dotted notes, tuplets and mixed durations are all accounted for: a 4/4
 * bar is 3840 ticks whether that is four quarters, eight eighths or a
 * triplet figure.
 *
 * Returns false for anything it cannot measure (no score, an index out of
 * range, a missing voice). A false negative simply means the editor adds a
 * beat where it might have started a bar — recoverable, and far better than
 * refusing to extend a score it failed to understand.
 */
export function isBarFull(score: any, barIndex: number): boolean {
  const masterBar = score?.masterBars?.[barIndex];
  const bar = score?.tracks?.[0]?.staves?.[0]?.bars?.[barIndex];
  const beats = bar?.voices?.[0]?.beats;
  if (!masterBar || !beats || typeof masterBar.calculateDuration !== "function") {
    return false;
  }

  const capacity = masterBar.calculateDuration();
  if (!Number.isFinite(capacity) || capacity <= 0) return false;

  let used = 0;
  for (const beat of beats) {
    const ticks = beat?.playbackDuration;
    if (!Number.isFinite(ticks)) return false;
    used += ticks;
  }
  return used >= capacity;
}
