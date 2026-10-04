/**
 * Which parent an imported Guitar Pro file hangs from.
 *
 * Three states are valid: a jam track's second source, one of a lesson
 * track's tabs, or neither — a standalone import listed under Jam Tracks.
 * Both at once is not: the file would be two different things, and the
 * lists that filter on one parent would each claim it.
 *
 * SQLite cannot express a mutually-exclusive pair of nullable foreign
 * keys, so this is the enforcement, and the routes are the only callers.
 */
export interface GpParentLink {
  jamTrackId?: string | null;
  trackId?: string | null;
}

/** An error sentence to send back, or null when the pair is storable. */
export function validateGpParent(link: GpParentLink): string | null {
  if (link.jamTrackId && link.trackId) {
    return "A Guitar Pro file belongs to a jam track or to an exercise, not both.";
  }
  return null;
}

/**
 * Whether this import stands on its own, which is what the Jam Tracks list
 * shows as a top-level entry.
 *
 * Both parents are checked, not just the jam track: an import attached to a
 * lesson track belongs in that exercise's tabs list and nowhere else.
 */
export function isStandaloneGpSong(song: GpParentLink): boolean {
  return !song.jamTrackId && !song.trackId;
}
