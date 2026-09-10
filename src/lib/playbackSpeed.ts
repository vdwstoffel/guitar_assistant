// Playback speed is stored as a whole percentage (10-200) on Track,
// JamTrack, BookVideo and Video alike. A NULL column means the speed was
// never set, which plays at normal speed. Media elements and WaveSurfer take
// a rate multiplier, so conversion happens at the boundary.

export const DEFAULT_PLAYBACK_SPEED = 100;
export const MIN_PLAYBACK_SPEED = 10;
export const MAX_PLAYBACK_SPEED = 200;

export function clampPlaybackSpeed(speed: number | null | undefined): number {
  if (speed === null || speed === undefined || Number.isNaN(speed)) {
    return DEFAULT_PLAYBACK_SPEED;
  }
  return Math.min(MAX_PLAYBACK_SPEED, Math.max(MIN_PLAYBACK_SPEED, Math.round(speed)));
}

export function speedToRate(speed: number | null | undefined): number {
  return clampPlaybackSpeed(speed) / 100;
}
