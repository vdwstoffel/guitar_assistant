export interface BarRange {
  /** Zero-based, inclusive. */
  startBar: number;
  endBar: number;
}

/**
 * Make a bar range storable, or refuse it.
 *
 * Swaps a backwards range rather than rejecting it: dragging right to left
 * across the score is an ordinary gesture and means the same section.
 * Clamps a range that overhangs the end, because the useful part of it is
 * real. Refuses one that lies entirely outside the song, where there is
 * nothing to clamp to and guessing would store a section pointing at music
 * that does not exist.
 */
export function normalizeBarRange(range: BarRange, barCount: number): BarRange | null {
  const { startBar, endBar } = range;
  if (!Number.isInteger(startBar) || !Number.isInteger(endBar)) return null;
  if (!Number.isInteger(barCount) || barCount <= 0) return null;

  const lo = Math.min(startBar, endBar);
  const hi = Math.max(startBar, endBar);
  if (lo > barCount - 1 || hi < 0) return null;

  return { startBar: Math.max(0, lo), endBar: Math.min(barCount - 1, hi) };
}
