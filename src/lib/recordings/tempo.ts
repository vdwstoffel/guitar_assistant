/**
 * Parse a tempo (playback speed percent) value coming from multipart FormData.
 * Returns a positive integer, or null when the value is missing/invalid.
 */
export function parseTempo(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const n = Number(raw.toString().trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}
