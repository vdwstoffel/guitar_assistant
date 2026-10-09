import { UNKNOWN_ARTIST } from "./songsterrUrl";

/** Runs of whitespace become single spaces; the ends are trimmed. */
function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * What to call the file a Songsterr import produces.
 *
 * The artist leads the name because the importer refuses a name already
 * taken, and song titles collide across bands far more often than
 * artist-and-title pairs do.
 */
export function gpFileNameFor(title: string, artist: string): string {
  const song = collapse(title).replace(/\.gp$/i, "");
  const band = collapse(artist);
  const stem = band && band !== UNKNOWN_ARTIST ? `${band} - ${song}` : song;
  return `${stem}.gp`;
}
