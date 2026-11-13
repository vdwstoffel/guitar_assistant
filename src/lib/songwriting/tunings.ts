import { findTuningPreset } from "../tabscore/commands/tuning";

/** The tunings the writing session offers, in pitch order. */
export const SESSION_TUNING_IDS = [
  "standard",
  "half-down",
  "full-down",
  "c-sharp-standard",
  "c-standard",
  "drop-d",
  "drop-c-sharp",
  "drop-c",
];

const PITCH_CLASS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** AlphaTex note name ("e2", "f#3", "bb2") to MIDI; e2 = 40. */
function noteToMidi(note: string): number {
  const m = /^([a-g])([#b]?)(-?\d+)$/i.exec(note);
  if (!m) throw new Error(`Bad note name: ${note}`);
  const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PITCH_CLASS[m[1].toLowerCase()] + accidental;
}

/** A guitar or bass preset. */
function preset(id: string) {
  const p = findTuningPreset(id);
  if (!p) throw new Error(`Unknown tuning: ${id}`);
  return p;
}

/** MIDI note of each open string, lowest string first (four for a bass tuning). */
export function tuningMidi(presetId: string): number[] {
  return preset(presetId).notes.map(noteToMidi).reverse();
}

export function tuningLabel(presetId: string): string {
  return preset(presetId).label;
}
