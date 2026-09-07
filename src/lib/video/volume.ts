// Video volume is stored per video in the database as a whole percentage
// (0-100), matching the Track.volume / JamTrack.volume convention. A NULL
// column means the volume was never set, which plays at full volume.
// Media elements use a 0-1 float, so conversion happens at the boundary.

export const DEFAULT_VOLUME = 100;

function clampStored(volume: number): number {
  return Math.min(100, Math.max(0, volume));
}

export function storedToElementVolume(volume: number | null | undefined): number {
  if (volume === null || volume === undefined || Number.isNaN(volume)) return 1;
  return clampStored(volume) / 100;
}

export function elementToStoredVolume(volume: number): number {
  if (Number.isNaN(volume)) return DEFAULT_VOLUME;
  return clampStored(Math.round(volume * 100));
}
