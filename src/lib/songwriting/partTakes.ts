/**
 * A part's own take: recorded in the Riffs view over a guide (the riff's other
 * parts, once the riff has a tempo), then trimmed like the capture panel's
 * take (spec, *The Riffs view*; ruling 8).
 */
import type { Riff, RiffPart } from "@/types";

export type Trim = { start: number; end: number };

/**
 * The riff as the guide plays it while a take is recorded for `partId`: that
 * part silent, the rest as the mixer has them. Its solo is dropped too, so
 * soloing the part being recorded does not silence the guide.
 */
export function guideRiff(riff: Riff, partId: string): Riff {
  if (!riff.parts.some((p) => p.id === partId)) return riff;
  return { ...riff, parts: riff.parts.map((p) => (p.id === partId ? { ...p, muted: true, soloed: false } : p)) };
}

/**
 * Where a saved take's handles start, and how far they may reach: the stored
 * trim, kept inside the shorter of the stored and the decoded length (the
 * server checks a trim against the stored one). A stored trim that no longer
 * fits gives the whole take.
 */
export function savedTakeTrim(
  part: Pick<RiffPart, "trimStart" | "trimEnd" | "audioDuration">,
  decodedDuration: number,
): { trim: Trim; duration: number } {
  const stored = part.audioDuration;
  const duration = stored !== null && stored > 0 ? Math.min(stored, decodedDuration) : decodedDuration;
  const start = Math.max(0, part.trimStart ?? 0);
  const end = Math.min(duration, part.trimEnd ?? duration);
  return { trim: end > start ? { start, end } : { start: 0, end: duration }, duration };
}

/** Whether a handle has moved (by a millisecond or more). */
export function trimMoved(a: Trim, b: Trim): boolean {
  return Math.abs(a.start - b.start) >= 0.001 || Math.abs(a.end - b.end) >= 0.001;
}

const TAKE_LOST = "The take you are recording is lost.";

/** The confirm before deleting a part: what goes with it, and the take being recorded. */
export function deletePartQuestion(part: Pick<RiffPart, "name" | "audioPath" | "alphatex">, recording: boolean): string {
  const take = !!part.audioPath;
  const tab = !!part.alphatex?.trim();
  const what = take && tab ? "Its recording and tab are" : take ? "Its recording is" : tab ? "Its tab is" : null;
  return [`Delete ${part.name}?`, what && `${what} deleted too.`, recording && TAKE_LOST].filter(Boolean).join(" ");
}

/** The confirm before deleting the riff. */
export function deleteRiffQuestion(name: string, recording: boolean): string {
  const q = `Delete “${name}”? Its recording and tab are deleted too.`;
  return recording ? `${q} ${TAKE_LOST}` : q;
}

/** A typed part name as it saves (the API's rule: 1-80 characters, trimmed), or null. */
export function parsePartName(text: string): string | null {
  const t = text.trim();
  return t.length >= 1 && t.length <= 80 ? t : null;
}
