/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's model types are only reachable through namespaces that cannot be
 * imported as types across the bundle boundary. These `any`s are the interop
 * boundary with that untyped surface, not unexamined typing.
 */
import type { Caret } from "./locate";

/**
 * The alphaTab Beat a caret points at, through track 0, staff 0, voice 0 —
 * the path the caret overlay has always used. No shape guard: the overlay
 * shows voice 0 of anything it is given. Null when an index is out of range.
 */
export function beatAt(score: any, caret: Caret): any | null {
  const bar = score?.tracks?.[0]?.staves?.[0]?.bars?.[caret.barIndex];
  return bar?.voices?.[0]?.beats?.[caret.beatIndex] ?? null;
}

/**
 * Whether a caret's indices can be trusted to name one beat of this score:
 * one track, one staff, and one voice in that bar. The editor writes nothing
 * else, but the Source pane accepts anything, and a preview would rather stay
 * silent than play a beat from the wrong voice.
 */
export function isPreviewable(score: any, barIndex: number): boolean {
  const tracks = score?.tracks;
  if (!Array.isArray(tracks) || tracks.length !== 1) return false;
  const staves = tracks[0]?.staves;
  if (!Array.isArray(staves) || staves.length !== 1) return false;
  const voices = staves[0]?.bars?.[barIndex]?.voices;
  return Array.isArray(voices) && voices.length === 1;
}

/**
 * Whether previewing this beat would make a sound: not a rest, and at least
 * one note that is struck. A tie destination is not struck — the earlier note
 * carries on — so a beat of nothing but tied-over notes is silent. The note a
 * legato slide lands on counts as struck: the preview sounds it (previewSynth).
 */
export function isAudible(beat: any): boolean {
  if (!beat || beat.isRest) return false;
  const notes: any[] = beat.notes ?? [];
  return notes.some((note) => !note.isTieDestination);
}
