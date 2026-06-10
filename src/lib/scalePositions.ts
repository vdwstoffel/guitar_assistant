/**
 * Fretboard mapping engine for the Scale Practice Generator.
 *
 * Converts abstract scale notes (e.g. "A Minor Pentatonic") into concrete
 * { string, fret } positions on the guitar, with MIDI numbers for pitch
 * ordering and octave math.
 */

import {
  getNoteAtFret,
  getScaleNotes,
  getNoteIndex,
} from './musicTheory';

export interface FretNote {
  /** 0 = 6th string (low E), 5 = 1st string (high E). */
  string: number;
  /** Fret number, 0 = open. */
  fret: number;
  /** Pitch class name, e.g. "A", "C#". */
  noteName: string;
  /** MIDI note number — used for ordering and AlphaTex octave validation. */
  midiNote: number;
}

export interface ScalePosition {
  positionNumber: number;
  fretRange: [number, number];
  /** Notes sorted ascending by MIDI pitch. */
  notes: FretNote[];
}

/** MIDI note of the open string for each string index (0 = low E2 → 5 = high E4). */
const OPEN_STRING_MIDI: readonly number[] = [40, 45, 50, 55, 59, 64];

/** Default fret range scanned for the fretboard. */
export const MIN_FRET = 0;
export const MAX_FRET = 15;

/** Five overlapping position windows that cover the neck. */
const POSITION_WINDOWS: readonly [number, number][] = [
  [0, 4],
  [3, 7],
  [5, 9],
  [7, 11],
  [9, 13],
  [12, 15],
];

function midiAt(stringIndex: number, fret: number): number {
  return OPEN_STRING_MIDI[stringIndex] + fret;
}

/** Build every note on the 6×16 fretboard grid. */
export function buildFretboardMap(): FretNote[] {
  const notes: FretNote[] = [];
  for (let s = 0; s < 6; s++) {
    for (let f = MIN_FRET; f <= MAX_FRET; f++) {
      notes.push({
        string: s,
        fret: f,
        noteName: getNoteAtFret(s, f),
        midiNote: midiAt(s, f),
      });
    }
  }
  return notes;
}

/** All notes belonging to the scale across the whole neck. */
export function getScaleNotesOnFretboard(root: string, scaleType: string): FretNote[] {
  const scaleNotes = new Set(getScaleNotes(root, scaleType));
  if (scaleNotes.size === 0) return [];
  return buildFretboardMap().filter((n) => scaleNotes.has(n.noteName));
}

/** Scale notes constrained to a fret window (inclusive). */
export function getScaleNotesInRange(
  root: string,
  scaleType: string,
  fretLow: number,
  fretHigh: number,
): FretNote[] {
  return getScaleNotesOnFretboard(root, scaleType).filter(
    (n) => n.fret >= fretLow && n.fret <= fretHigh,
  );
}

/**
 * Group scale notes into the five standard position windows, anchored
 * around the root note when possible. Each position returns notes sorted
 * by ascending MIDI pitch (low-string-low-fret → high-string-high-fret).
 */
export function getScalePositions(root: string, scaleType: string): ScalePosition[] {
  const rootIdx = getNoteIndex(root);
  if (rootIdx === -1) return [];

  return POSITION_WINDOWS.map(([low, high], idx) => {
    const notes = getScaleNotesInRange(root, scaleType, low, high).sort(
      (a, b) => a.midiNote - b.midiNote,
    );
    return {
      positionNumber: idx + 1,
      fretRange: [low, high] as [number, number],
      notes,
    };
  }).filter((p) => p.notes.length > 0);
}

/**
 * Return one note per scale degree on a single string (for two-string /
 * string-skipping exercises). Always sorted ascending by fret.
 */
export function getScaleNotesOnString(
  root: string,
  scaleType: string,
  stringIndex: number,
  fretLow: number = MIN_FRET,
  fretHigh: number = MAX_FRET,
): FretNote[] {
  const scaleSet = new Set(getScaleNotes(root, scaleType));
  const out: FretNote[] = [];
  for (let f = fretLow; f <= fretHigh; f++) {
    const name = getNoteAtFret(stringIndex, f);
    if (scaleSet.has(name)) {
      out.push({
        string: stringIndex,
        fret: f,
        noteName: name,
        midiNote: midiAt(stringIndex, f),
      });
    }
  }
  return out;
}

