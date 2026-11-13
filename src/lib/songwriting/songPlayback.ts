/**
 * Play song's running order (spec "The Songs view", ruling 7): the sections
 * play one after another, each riff its repeats times, as one score with no
 * stop between them. A section without a riff is passed over, and so is one
 * whose riff could not be loaded or has no tempo yet (with a note); after the
 * last section the song stops by itself. Prisma- and React-free.
 */
import type { Riff } from "@/types";

/** The note for a section passed over because its riff has no tempo yet: nothing to keep its parts together. */
export function noTempoNote(label: string): string {
  return `Skipped “${label}”: its riff has no tempo yet. Tap it on the riff's page.`;
}

/** The note for a section passed over because its riff would not load. */
export function skippedNote(label: string, reason: { gone: boolean; message?: string }): string {
  return reason.gone
    ? `Skipped “${label}”: its riff was deleted.`
    : `Skipped “${label}”: its riff could not be loaded (${reason.message ?? "unknown error"}).`;
}

/** How a section's riff came back from the server. */
export type FetchedRiff = { ok: true; riff: Riff } | { ok: false; gone: boolean; message?: string };

/** What one press of Play plays: the sections from `from` on that can play, each with its row. */
export interface SongProgram {
  sections: { riff: Riff; repeats: number; row: number }[];
  /** One per section passed over for a reason worth saying. */
  notes: string[];
  /** A riff turned out to be deleted: the rows should be refreshed. */
  gone: boolean;
}

/** The sections a run from row `from` plays, in order, given each riff as fetched (by id). */
export function songProgram(
  rows: readonly { label: string; riffId: string | null; repeats: number }[],
  from: number,
  fetched: ReadonlyMap<string, FetchedRiff>,
): SongProgram {
  const out: SongProgram = { sections: [], notes: [], gone: false };
  rows.forEach((row, i) => {
    if (i < from || !row.riffId) return;
    const got = fetched.get(row.riffId);
    if (!got) return;
    if (!got.ok) {
      out.notes.push(skippedNote(row.label, got));
      out.gone ||= got.gone;
    } else if (got.riff.tempo === null) {
      out.notes.push(noTempoNote(row.label));
    } else {
      out.sections.push({ riff: got.riff, repeats: row.repeats, row: i });
    }
  });
  out.notes = [...new Set(out.notes)];
  return out;
}
