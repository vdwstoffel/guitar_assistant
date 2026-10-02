import type { GpSong } from "@/types";

/** Row shape as Prisma returns it, with trackNames still a JSON string. */
type GpSongRow = Omit<
  GpSong,
  "trackNames" | "sections" | "lastPlayedAt" | "completedAt" | "createdAt"
> & {
  trackNames: string;
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
    sections: row.sections ?? [],
    lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
