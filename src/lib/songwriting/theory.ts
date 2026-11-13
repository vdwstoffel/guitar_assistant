import {
  CHORD_FORMULAS,
  SCALE_FORMULAS,
  getDiatonicChords,
  getNoteIndex,
  getNoteName,
} from "../musicTheory";
import { INTERVAL_REFERENCE } from "../intervalReference";

/** The chord qualities the writing session offers, in picker order. */
export type ChordQuality =
  | "Power"
  | "Major"
  | "Minor"
  | "Diminished"
  | "Augmented"
  | "Sus2"
  | "Sus4"
  | "Dom7"
  | "Min7"
  | "Maj7";

export const CHORD_QUALITIES: ChordQuality[] = [
  "Power",
  "Major",
  "Minor",
  "Diminished",
  "Augmented",
  "Sus2",
  "Sus4",
  "Dom7",
  "Min7",
  "Maj7",
];

/** One chord in a progression, held for `bars` bars. */
export interface ProgressionChord {
  root: string;
  quality: ChordQuality;
  bars: number;
}

const SUFFIX: Record<ChordQuality, string> = {
  Power: "5",
  Major: "",
  Minor: "m",
  Diminished: "dim",
  Augmented: "aug",
  Sus2: "sus2",
  Sus4: "sus4",
  Dom7: "7",
  Min7: "m7",
  Maj7: "maj7",
};

export function chordName(c: ProgressionChord): string {
  return `${c.root}${SUFFIX[c.quality]}`;
}

/** Pitch classes (0-11) of a chord's notes, root first. */
export function chordPitchClasses(c: ProgressionChord): number[] {
  const root = getNoteIndex(c.root);
  return CHORD_FORMULAS[c.quality].map((s) => (root + s) % 12);
}

/** Pitch classes (0-11) of a scale, root first. */
export function scalePitchClasses(root: string, scale: string): number[] {
  const r = getNoteIndex(root);
  const formula = SCALE_FORMULAS[scale];
  if (r === -1 || !formula) return [];
  return formula.intervals.map((s) => (r + s) % 12);
}

export function progressionBars(chords: ProgressionChord[]): number {
  return chords.reduce((sum, c) => sum + c.bars, 0);
}

/** Which chord sounds in a 0-based bar; the progression loops. */
export function chordIndexAtBar(chords: ProgressionChord[], bar: number): number | null {
  const total = progressionBars(chords);
  if (total === 0) return null;
  let left = ((bar % total) + total) % total;
  for (let i = 0; i < chords.length; i++) {
    if (left < chords[i].bars) return i;
    left -= chords[i].bars;
  }
  return null;
}

export const INTERVAL_LABELS = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];

/** The interval of `toPc` above `fromPc`, as a scale-degree label. */
export function intervalLabel(fromPc: number, toPc: number): string {
  return INTERVAL_LABELS[(((toPc - fromPc) % 12) + 12) % 12];
}

/** How an interval of 0-11 semitones sounds, in words. */
export function intervalFeel(semitones: number): string {
  return INTERVAL_REFERENCE.find((i) => i.semitones === semitones)?.soundDescription ?? "";
}

export interface FretCell {
  /** 0 = lowest-pitched string. */
  string: number;
  fret: number;
  pc: number;
  noteName: string;
  inScale: boolean;
  chordTone: boolean;
  isReferenceRoot: boolean;
  /** Interval above the reference root, e.g. "b3". */
  label: string;
}

/** Every fret position whose note is in the scale or the chord. */
export function fretboardCells(o: {
  /** MIDI note numbers, lowest string first. */
  tuning: number[];
  keyRoot: string;
  scale: string;
  referenceRoot: string;
  chordPcs: number[];
  frets?: number;
}): FretCell[] {
  const frets = o.frets ?? 15;
  const scalePcs = new Set(scalePitchClasses(o.keyRoot, o.scale));
  const chordPcs = new Set(o.chordPcs);
  const refPc = getNoteIndex(o.referenceRoot);
  const cells: FretCell[] = [];
  o.tuning.forEach((open, string) => {
    for (let fret = 0; fret <= frets; fret++) {
      const pc = (open + fret) % 12;
      const inScale = scalePcs.has(pc);
      const chordTone = chordPcs.has(pc);
      if (!inScale && !chordTone) continue;
      cells.push({
        string,
        fret,
        pc,
        noteName: getNoteName(pc),
        inScale,
        chordTone,
        isReferenceRoot: pc === refPc,
        label: intervalLabel(refPc, pc),
      });
    }
  });
  return cells;
}

/**
 * Chords to offer for a key: each diatonic root as a power chord, then as its
 * triad. A power chord on a root already listed is not repeated.
 */
export function suggestedChords(keyRoot: string, scale: string): ProgressionChord[] {
  const out: ProgressionChord[] = [];
  const seen = new Set<string>();
  for (const d of getDiatonicChords(keyRoot, scale).chords) {
    if (!seen.has(`${d.root}:Power`)) {
      seen.add(`${d.root}:Power`);
      out.push({ root: d.root, quality: "Power", bars: 1 });
    }
    if (!seen.has(`${d.root}:${d.quality}`)) {
      seen.add(`${d.root}:${d.quality}`);
      out.push({ root: d.root, quality: d.quality, bars: 1 });
    }
  }
  return out;
}
