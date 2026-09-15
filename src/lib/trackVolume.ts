// Track and JamTrack volume is stored per item in the database as a whole
// percentage (0-100). A NULL column means the volume was never set, which
// plays at the waveform player's long-standing 50% default. (Videos use their
// own DEFAULT_VOLUME of 100 — see src/lib/video/volume.ts.)

export const DEFAULT_TRACK_VOLUME = 50;

export function clampTrackVolume(volume: number): number {
  if (Number.isNaN(volume)) return DEFAULT_TRACK_VOLUME;
  return Math.min(100, Math.max(0, Math.round(volume)));
}

// The volume to play a track at, given whatever its column holds.
export function resolveTrackVolume(volume: number | null | undefined): number {
  if (volume === null || volume === undefined || Number.isNaN(volume)) {
    return DEFAULT_TRACK_VOLUME;
  }
  return clampTrackVolume(volume);
}

// Write a just-saved volume back into an in-memory list of tracks or jam
// tracks. The player persists the volume to the database on its own, but the
// list it is handed on the next selection comes from client state — without
// this the stale volume from the last library fetch wins.
export function applySavedVolume<T extends { id: string; volume: number | null }>(
  items: T[],
  id: string,
  volume: number
): T[] {
  if (!items.some((item) => item.id === id)) return items;
  const clamped = clampTrackVolume(volume);
  return items.map((item) => (item.id === id ? { ...item, volume: clamped } : item));
}
