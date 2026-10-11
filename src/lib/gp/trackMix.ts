/**
 * The mixer settings of one Guitar Pro track, held per song.
 *
 * Positional, index-aligned with the song's `trackNames` — a GP track has no
 * identity of its own beyond where it sits in the score, which is also why
 * this is a JSON column rather than a table. The whole mix is read and
 * written together; there is nothing to query a single channel for.
 */
export interface TrackMix {
  /** 0-1, as alphaTab's changeTrackVolume takes it. */
  level: number;
  muted: boolean;
  soloed: boolean;
}

/** Full volume, audible, not soloed: how a file plays before anyone touches it. */
export const DEFAULT_TRACK_MIX: TrackMix = { level: 1, muted: false, soloed: false };

function clampLevel(level: number): number {
  return Math.min(1, Math.max(0, level));
}

/** A channel is only trusted when every field survived the round trip intact. */
function channelAt(parsed: unknown[], index: number): TrackMix {
  const raw = parsed[index];
  if (typeof raw !== "object" || raw === null) return DEFAULT_TRACK_MIX;
  const { level, muted, soloed } = raw as Record<string, unknown>;
  if (typeof level !== "number" || Number.isNaN(level)) return DEFAULT_TRACK_MIX;
  if (typeof muted !== "boolean" || typeof soloed !== "boolean") return DEFAULT_TRACK_MIX;
  return { level: clampLevel(level), muted, soloed };
}

/**
 * The mix to open a song with, given whatever its column holds.
 *
 * Always returns exactly `trackCount` channels. The stored mix can be the
 * wrong length — a file re-imported with a different arrangement keeps its
 * row — and a short one would otherwise leave the mixer reading `undefined`
 * for the tracks past its end. A corrupt column plays all-audible rather
 * than throwing: a song you cannot hear is worse than a mix you must set
 * again.
 */
export function parseTrackMix(json: string | null | undefined, trackCount: number): TrackMix[] {
  let parsed: unknown = null;
  if (json) {
    try {
      parsed = JSON.parse(json);
    } catch {
      /* an unreadable column is a mix nobody set */
    }
  }
  const channels = Array.isArray(parsed) ? parsed : [];
  return Array.from({ length: trackCount }, (_, i) => channelAt(channels, i));
}

function isDefault(channel: TrackMix): boolean {
  return channel.level === DEFAULT_TRACK_MIX.level && !channel.muted && !channel.soloed;
}

/**
 * The column value for a mix, or null when there is nothing worth keeping.
 *
 * An untouched mixer stores nothing, so a song that was only ever played
 * keeps a NULL column and opens all-audible however the defaults change.
 */
export function serializeTrackMix(mix: TrackMix[]): string | null {
  if (mix.every(isDefault)) return null;
  return JSON.stringify(
    mix.map(({ level, muted, soloed }) => ({ level: clampLevel(level), muted, soloed })),
  );
}

/**
 * The column value for a mix arriving from the client, which is untrusted.
 *
 * Normalised through the same reader a load uses, so the row can only ever
 * hold a mix the player will accept — a bad request stores nothing rather
 * than a channel that silently plays as a default forever after.
 */
export function trackMixColumn(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  return serializeTrackMix(parseTrackMix(JSON.stringify(value), value.length));
}

/**
 * The mixer holds its state as three parallel arrays, one per control, so
 * that a fader move re-renders only its own; this gathers them back into the
 * per-track shape the row stores.
 */
export function toTrackMix(levels: number[], muted: boolean[], soloed: boolean[]): TrackMix[] {
  return levels.map((level, i) => ({
    level,
    muted: muted[i] ?? false,
    soloed: soloed[i] ?? false,
  }));
}

/**
 * The channels to open the mixer with: the song's saved mix, padded to the
 * tracks actually on screen. Songs fetched before this column existed, and
 * a file whose arrangement changed under its row, both land here.
 */
export function channelsOf(mix: TrackMix[] | undefined | null, trackCount: number): TrackMix[] {
  return Array.from({ length: trackCount }, (_, i) => mix?.[i] ?? DEFAULT_TRACK_MIX);
}
