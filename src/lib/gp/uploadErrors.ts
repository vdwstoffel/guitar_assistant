/** One file's outcome, as the upload routes report it. */
export interface UploadResult {
  name: string;
  success: boolean;
  error?: string;
}

/**
 * One message naming every file that failed, or null when none did.
 *
 * The upload route already explains each failure in a sentence a person can
 * act on, so this repeats it rather than classifying it again. Tolerant of
 * a response that is not the expected shape — a 500 returns `{ error }`
 * with no results at all, and reporting nothing is better than throwing
 * inside a catch-less handler.
 */
export function describeUploadFailures(results: unknown): string | null {
  if (!Array.isArray(results)) return null;

  const failed = results.filter(
    (entry): entry is UploadResult =>
      !!entry && typeof entry === "object" && (entry as UploadResult).success === false,
  );
  if (failed.length === 0) return null;

  return failed.map((r) => `${r.name}: ${r.error ?? "could not be imported"}`).join("\n");
}
