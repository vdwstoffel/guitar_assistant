/**
 * What removing a track's imports needs from the outside world.
 *
 * Injected rather than imported, so the ordering and the missing-file
 * behaviour below can be tested without a database or a filesystem.
 * `prismaGpSongRemovalDeps` is the only implementation production uses.
 */
export interface GpSongRemovalDeps {
  /** The imports attached to these tracks. */
  find(trackIds: string[]): Promise<{ id: string; filePath: string }[]>;
  /** Remove those rows. */
  remove(ids: string[]): Promise<void>;
  /** Delete one file, given its path relative to MUSIC_DIR. */
  unlink(filePath: string): Promise<void>;
}

/**
 * Delete the Guitar Pro imports belonging to these tracks, files and all.
 *
 * `GpSong.trackId` cascades, so the rows would go on their own — but a
 * database cascade cannot unlink a file, and an orphaned `.gp` in
 * `music/GpSongs/` is litter nothing in the UI can ever reach again, in a
 * directory that is a mounted volume. Call this BEFORE deleting the
 * tracks.
 *
 * Rows first, files second, matching `DELETE /api/gpsongs/[id]`. A file
 * that is already gone is not an error — the commonest caller is the
 * library scan, which deletes a track precisely because its files
 * disappeared.
 *
 * Returns how many imports were removed.
 */
export async function deleteGpSongsForTracks(
  trackIds: string[],
  deps: GpSongRemovalDeps,
): Promise<number> {
  if (trackIds.length === 0) return 0;

  const songs = await deps.find(trackIds);
  if (songs.length === 0) return 0;

  await deps.remove(songs.map((song) => song.id));
  for (const song of songs) {
    await deps.unlink(song.filePath).catch(() => {
      /* already gone, which is the outcome we wanted anyway */
    });
  }

  return songs.length;
}
