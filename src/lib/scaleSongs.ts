// Which songs the fretboard's Songs panel shows.
//
// With a scale selected the panel is a per-scale/key library, so it shows only
// the songs recorded against that exact root + scale. With no scale selected
// there is nothing to filter by, so it lists everything — that list doubles as
// a way in: picking a song switches the fretboard to that song's key and scale.
export function visibleScaleSongs<T extends { rootNote: string; scaleType: string }>(
  songs: T[],
  root: string,
  scaleType: string
): T[] {
  if (scaleType === "None") return songs;
  return songs.filter((s) => s.rootNote === root && s.scaleType === scaleType);
}
