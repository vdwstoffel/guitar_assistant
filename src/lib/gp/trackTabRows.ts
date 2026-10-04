import type { GpSong, TrackTab } from "@/types";

/**
 * One row of a lesson track's tabs list, which holds two kinds of thing:
 * tabs scored by hand in the canvas editor, and Guitar Pro files imported
 * whole. They live in different tables and open in different components,
 * so the row carries its kind and the record behind it.
 */
export type TrackTabRow =
  | { kind: "alphatex"; id: string; name: string; subtitle: string; tab: TrackTab }
  | { kind: "gp"; id: string; name: string; subtitle: string; song: GpSong };

/**
 * The grey line under an import's name.
 *
 * Every part is optional except the bar count: a Guitar Pro file need not
 * declare an artist or a tempo, and `parseGpMetadata` stores null when it
 * does not. Built by joining the parts that exist rather than by
 * interpolating a template, so a missing one leaves no "null" and no
 * trailing separator.
 */
export function gpSubtitle(song: GpSong): string {
  const parts: string[] = [];
  if (song.artist) parts.push(song.artist);
  parts.push(`${song.barCount} ${song.barCount === 1 ? "bar" : "bars"}`);
  if (song.tempo) parts.push(`${song.tempo} BPM`);
  return parts.join(" · ");
}

/**
 * Both kinds in one ordered list.
 *
 * Scored tabs keep their own `sortOrder`, which the user controls; imports
 * follow in the order they arrived. The two are not interleaved, because
 * `sortOrder` lives on only one of the two tables and inventing a shared
 * one would mean writing to both every time either list is reordered.
 *
 * Copies before sorting: the arrays come straight from React state, and
 * `Array.prototype.sort` works in place.
 */
export function trackTabRows(tabs: TrackTab[], imports: GpSong[]): TrackTabRow[] {
  const scored: TrackTabRow[] = [...tabs]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((tab) => ({
      kind: "alphatex",
      id: tab.id,
      name: tab.name,
      subtitle: `${tab.tempo} BPM`,
      tab,
    }));

  const imported: TrackTabRow[] = [...imports]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((song) => ({
      kind: "gp",
      id: song.id,
      name: song.title,
      subtitle: gpSubtitle(song),
      song,
    }));

  return [...scored, ...imported];
}
