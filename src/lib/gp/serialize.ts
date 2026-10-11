import type { GpSong } from "@/types";
import { parseTrackMix } from "./trackMix";

/** Row shape as Prisma returns it, with the JSON columns still strings. */
type GpSongRow = Omit<
  GpSong,
  "trackNames" | "trackMix" | "sections" | "lastPlayedAt" | "completedAt" | "createdAt"
> & {
  trackNames: string;
  trackMix: string | null;
  lastPlayedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  sections?: GpSong["sections"];
};

/**
 * One place turns a row into the API shape, so no caller ever sees the raw
 * JSON column.
 *
 * A corrupt trackNames column yields an empty list rather than throwing —
 * the song is still playable, and the picker falls back to numbered parts.
 * The mixer is sized to whatever names survived, so the two can never
 * disagree about how many tracks there are.
 */
export function serializeGpSong(row: GpSongRow): GpSong {
  let trackNames: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.trackNames);
    if (Array.isArray(parsed)) trackNames = parsed.map(String);
  } catch {
    /* leave it empty */
  }
  return {
    ...row,
    trackNames,
    trackMix: parseTrackMix(row.trackMix, trackNames.length),
    sections: row.sections ?? [],
    lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
