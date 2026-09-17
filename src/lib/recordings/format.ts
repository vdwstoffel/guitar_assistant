/**
 * Format a recording length (in seconds) as m:ss.
 * Returns an em dash when the duration is missing or nonsensical.
 */
export function formatDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
