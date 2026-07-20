/**
 * Shared music theory constants and utility functions.
 *
 * Centralizes note names, intervals, scale formulas, chord formulas,
 * and common helper calculations used across multiple components
 * (Fretboard, CircleOfFifths, future theory tools).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Chromatic note names using sharps (index 0 = C, index 11 = B). */
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Standard guitar tuning from 6th (low E) to 1st (high E) string, as note names. */
export const STANDARD_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'] as const;

/** Standard guitar tuning as chromatic indices (E=4, A=9, D=2, G=7, B=11, E=4). */
export const STANDARD_TUNING_INDICES = [4, 9, 2, 7, 11, 4] as const;

/** Map of interval names to semitone distances. */
export const INTERVALS: Record<string, number> = {
  'Unison': 0,
  'Minor 2nd': 1,
  'Major 2nd': 2,
  'Minor 3rd': 3,
  'Major 3rd': 4,
  'Perfect 4th': 5,
  'Tritone': 6,
  'Perfect 5th': 7,
  'Minor 6th': 8,
  'Major 6th': 9,
  'Minor 7th': 10,
  'Major 7th': 11,
  'Octave': 12,
};

/** Array indexed by semitone distance (0-12) giving the interval name. */
export const INTERVAL_NAMES: string[] = [
  'Unison',       // 0
  'Minor 2nd',    // 1
  'Major 2nd',    // 2
  'Minor 3rd',    // 3
  'Major 3rd',    // 4
  'Perfect 4th',  // 5
  'Tritone',      // 6
  'Perfect 5th',  // 7
  'Minor 6th',    // 8
  'Major 6th',    // 9
  'Minor 7th',    // 10
  'Major 7th',    // 11
  'Octave',       // 12
];

// ---------------------------------------------------------------------------
// Scale Formulas
// ---------------------------------------------------------------------------

export interface ScaleInfo {
  intervals: number[];
  description: string;
  genres: string[];
}

/**
 * Scale formulas as arrays of semitone intervals from the root.
 * Includes major/minor, pentatonics, blues, modes, and harmonic minor.
 * The "None" entry (empty intervals) is used by Fretboard to mean "show all notes".
 */
export const SCALE_FORMULAS: Record<string, ScaleInfo> = {
  'None': {
    intervals: [],
    description: '',
    genres: [],
  },
  'Major': {
    intervals: [0, 2, 4, 5, 7, 9, 11],
    description: 'The foundation of Western music. Bright, happy, and resolved sound. Also known as the Ionian mode.',
    genres: ['Pop', 'Country', 'Classical', 'Rock', 'Folk'],
  },
  'Minor': {
    intervals: [0, 2, 3, 5, 7, 8, 10],
    description: 'The natural minor scale. Dark, melancholic, and emotional. Also known as the Aeolian mode.',
    genres: ['Rock', 'Metal', 'Classical', 'Pop', 'R&B'],
  },
  'Minor Pentatonic': {
    intervals: [0, 3, 5, 7, 10],
    description: 'The most essential guitar scale. Five notes, no wrong notes. The go-to scale for soloing and improvisation.',
    genres: ['Blues', 'Rock', 'Classic Rock', 'Hard Rock', 'Metal'],
  },
  'Major Pentatonic': {
    intervals: [0, 2, 4, 7, 9],
    description: 'Bright and open five-note scale. Sweet, uplifting sound without any tension. Great for country licks and melodic solos.',
    genres: ['Country', 'Pop', 'Folk', 'Rock', 'Gospel'],
  },
  'Blues': {
    intervals: [0, 3, 5, 6, 7, 10],
    description: 'Minor pentatonic with an added flat 5th (the "blue note"). Gritty, soulful, and expressive.',
    genres: ['Blues', 'Rock', 'Jazz', 'Funk', 'R&B'],
  },
  'Dorian': {
    intervals: [0, 2, 3, 5, 7, 9, 10],
    description: 'Minor scale with a raised 6th. Jazzy and sophisticated with a slightly brighter feel than natural minor.',
    genres: ['Jazz', 'Funk', 'Blues', 'Latin', 'Rock'],
  },
  'Phrygian': {
    intervals: [0, 1, 3, 5, 7, 8, 10],
    description: 'Minor scale with a flat 2nd. Exotic, Spanish-flavored sound. Dark and mysterious.',
    genres: ['Flamenco', 'Metal', 'Prog Rock', 'Latin', 'Film Scores'],
  },
  'Lydian': {
    intervals: [0, 2, 4, 6, 7, 9, 11],
    description: 'Major scale with a raised 4th. Dreamy, floating, and ethereal. Creates a sense of wonder.',
    genres: ['Jazz', 'Prog Rock', 'Film Scores', 'Ambient', 'Fusion'],
  },
  'Mixolydian': {
    intervals: [0, 2, 4, 5, 7, 9, 10],
    description: 'Major scale with a flat 7th. Bluesy-major sound, strong and confident. The dominant scale.',
    genres: ['Blues', 'Rock', 'Country', 'Funk', 'Jam Band'],
  },
  'Harmonic Minor': {
    intervals: [0, 2, 3, 5, 7, 8, 11],
    description: 'Natural minor with a raised 7th. Classical and dramatic with an exotic, Middle Eastern flavor.',
    genres: ['Classical', 'Metal', 'Neoclassical', 'Flamenco', 'Jazz'],
  },
};

export type ScaleType = keyof typeof SCALE_FORMULAS;

// ---------------------------------------------------------------------------
// Chord Formulas
// ---------------------------------------------------------------------------

/**
 * Chord formulas as arrays of semitone intervals from the root.
 * Covers common triads, seventh chords, and extended chords.
 */
export const CHORD_FORMULAS: Record<string, number[]> = {
  'Major':       [0, 4, 7],
  'Minor':       [0, 3, 7],
  'Diminished':  [0, 3, 6],
  'Augmented':   [0, 4, 8],
  'Sus2':        [0, 2, 7],
  'Sus4':        [0, 5, 7],
  'Dom7':        [0, 4, 7, 10],
  'Maj7':        [0, 4, 7, 11],
  'Min7':        [0, 3, 7, 10],
  'MinMaj7':     [0, 3, 7, 11],
  'Dim7':        [0, 3, 6, 9],
  'HalfDim7':    [0, 3, 6, 10],
  'Aug7':        [0, 4, 8, 10],
  'Dom9':        [0, 4, 7, 10, 14],
  'Maj9':        [0, 4, 7, 11, 14],
  'Min9':        [0, 3, 7, 10, 14],
  'Add9':        [0, 4, 7, 14],
  'Power':       [0, 7],
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Get the chromatic index (0-11) for a note name.
 * Handles sharps only (the canonical representation in NOTES).
 * Returns -1 if the note name is not found.
 */
export function getNoteIndex(note: string): number {
  return NOTES.indexOf(note as typeof NOTES[number]);
}

/**
 * Get the note name from a chromatic index (0-11).
 * Wraps around using modulo so any integer works.
 */
export function getNoteName(index: number): string {
  return NOTES[((index % 12) + 12) % 12];
}

/**
 * Calculate the note name at a specific fretboard position.
 * @param stringIndex - 0-based string index (0 = 6th/low E, 5 = 1st/high E)
 * @param fret - fret number (0 = open string)
 * @param tuning - optional array of chromatic indices per string (defaults to standard tuning)
 */
export function getNoteAtFret(
  stringIndex: number,
  fret: number,
  tuning: readonly number[] = STANDARD_TUNING_INDICES,
): string {
  const openNoteIndex = tuning[stringIndex];
  return getNoteName(openNoteIndex + fret);
}

/**
 * Get the semitone distance between two notes (always 0-11, ascending).
 */
export function getInterval(note1: string, note2: string): number {
  const i1 = getNoteIndex(note1);
  const i2 = getNoteIndex(note2);
  return ((i2 - i1) + 12) % 12;
}

/**
 * Get the human-readable interval name for a semitone distance.
 * Distances larger than 12 are reduced modulo 12.
 */
export function getIntervalName(semitones: number): string {
  const normalized = ((semitones % 12) + 12) % 12;
  return INTERVAL_NAMES[normalized];
}

/**
 * Get all note names in a scale.
 * @param root - root note name (e.g. "C", "F#")
 * @param scaleType - key into SCALE_FORMULAS (e.g. "Major", "Blues")
 * @returns array of note names, or empty array if scaleType is unknown or "None"
 */
export function getScaleNotes(root: string, scaleType: string): string[] {
  const formula = SCALE_FORMULAS[scaleType];
  if (!formula || formula.intervals.length === 0) return [];
  const rootIndex = getNoteIndex(root);
  if (rootIndex === -1) return [];
  return formula.intervals.map((semitones) => getNoteName(rootIndex + semitones));
}

/**
 * Get the note names that make up a chord.
 * @param root - root note name
 * @param chordType - key into CHORD_FORMULAS (e.g. "Major", "Dom7")
 * @returns array of note names, or empty array if chordType is unknown
 */
export function getChordNotes(root: string, chordType: string): string[] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) return [];
  const rootIndex = getNoteIndex(root);
  if (rootIndex === -1) return [];
  return formula.map((semitones) => getNoteName(rootIndex + semitones));
}

// ---------------------------------------------------------------------------
// Diatonic chords for a scale
// ---------------------------------------------------------------------------

/** A chord built on one degree of a scale. */
export interface DiatonicChord {
  /** Full chord symbol, e.g. "Am", "F", "A#dim". */
  name: string;
  /** Root note name of the chord, e.g. "A". */
  root: string;
  quality: 'Major' | 'Minor' | 'Diminished' | 'Augmented';
  /** Roman-numeral function, e.g. "i", "VI", "vii°", "III+". */
  roman: string;
  /** 0-based position of the chord within the scale. */
  degreeIndex: number;
}

/**
 * Pentatonic/blues scales have 5-6 notes and no clean stack-of-thirds triads,
 * so their diatonic chords are taken from a parent heptatonic scale of the
 * same root.
 */
const PARENT_SCALE_FOR_CHORDS: Record<string, ScaleType> = {
  'Minor Pentatonic': 'Minor',
  'Major Pentatonic': 'Major',
  'Blues': 'Minor',
};

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const QUALITY_SUFFIX: Record<DiatonicChord['quality'], string> = {
  Major: '',
  Minor: 'm',
  Diminished: 'dim',
  Augmented: 'aug',
};

/** Classify a triad from the semitone sizes of its 3rd and 5th above the root. */
function triadQuality(
  thirdSemis: number,
  fifthSemis: number,
): DiatonicChord['quality'] {
  if (thirdSemis === 4 && fifthSemis === 7) return 'Major';
  if (thirdSemis === 3 && fifthSemis === 7) return 'Minor';
  if (thirdSemis === 3 && fifthSemis === 6) return 'Diminished';
  if (thirdSemis === 4 && fifthSemis === 8) return 'Augmented';
  // Fallback for unusual stacks: classify by the third.
  return thirdSemis <= 3 ? 'Minor' : 'Major';
}

/** Build the roman numeral for a degree given its chord quality. */
function romanFor(degreeIndex: number, quality: DiatonicChord['quality']): string {
  const base = ROMAN_NUMERALS[degreeIndex];
  switch (quality) {
    case 'Major':
      return base;
    case 'Augmented':
      return base + '+';
    case 'Minor':
      return base.toLowerCase();
    case 'Diminished':
      return base.toLowerCase() + '°';
  }
}

/**
 * Return the diatonic chords for a scale, built by stacking thirds within the
 * scale's own notes. For pentatonic/blues scales the chords come from a parent
 * heptatonic scale (see PARENT_SCALE_FOR_CHORDS); `parentScale` names that
 * scale, or is null when the requested scale is used directly.
 *
 * Returns empty chords for "None" or any scale that is not 7 notes after the
 * parent mapping.
 */
export function getDiatonicChords(
  root: string,
  scaleType: string,
): { chords: DiatonicChord[]; parentScale: ScaleType | null } {
  const parentScale = PARENT_SCALE_FOR_CHORDS[scaleType] ?? null;
  const effectiveScale = parentScale ?? scaleType;
  const notes = getScaleNotes(root, effectiveScale);
  if (notes.length !== 7) return { chords: [], parentScale };

  const chords: DiatonicChord[] = notes.map((chordRoot, i) => {
    const third = notes[(i + 2) % 7];
    const fifth = notes[(i + 4) % 7];
    const quality = triadQuality(
      getInterval(chordRoot, third),
      getInterval(chordRoot, fifth),
    );
    return {
      root: chordRoot,
      quality,
      name: chordRoot + QUALITY_SUFFIX[quality],
      roman: romanFor(i, quality),
      degreeIndex: i,
    };
  });

  return { chords, parentScale };
}

/**
 * Check whether a note belongs to a given scale.
 * When scaleType is "None" or unrecognized, returns true (all notes pass).
 */
export function isNoteInScale(note: string, root: string, scaleType: string): boolean {
  const formula = SCALE_FORMULAS[scaleType];
  if (!formula || formula.intervals.length === 0) return true;

  const rootIndex = getNoteIndex(root);
  const noteIndex = getNoteIndex(note);
  const intervalFromRoot = ((noteIndex - rootIndex) + 12) % 12;
  return formula.intervals.includes(intervalFromRoot);
}

/**
 * Check whether a note is the root of a given key.
 */
export function isRootNote(note: string, root: string): boolean {
  return note === root;
}

// ---------------------------------------------------------------------------
// Interval Abbreviations & Scale Degree Labels
// ---------------------------------------------------------------------------

/**
 * Short interval abbreviations indexed by semitone distance (0-11).
 * Used for interval label mode on the fretboard.
 */
export const INTERVAL_ABBREVIATIONS: string[] = [
  'R',   // 0 - Root/Unison
  'm2',  // 1 - Minor 2nd
  'M2',  // 2 - Major 2nd
  'm3',  // 3 - Minor 3rd
  'M3',  // 4 - Major 3rd
  'P4',  // 5 - Perfect 4th
  'TT',  // 6 - Tritone
  'P5',  // 7 - Perfect 5th
  'm6',  // 8 - Minor 6th
  'M6',  // 9 - Major 6th
  'm7',  // 10 - Minor 7th
  'M7',  // 11 - Major 7th
];

/**
 * Scale degree labels indexed by semitone distance (0-11).
 * Uses flat/sharp notation relative to the major scale.
 */
export const DEGREE_LABELS: string[] = [
  '1',   // 0
  'b2',  // 1
  '2',   // 2
  'b3',  // 3
  '3',   // 4
  '4',   // 5
  'b5',  // 6
  '5',   // 7
  'b6',  // 8
  '6',   // 9
  'b7',  // 10
  '7',   // 11
];

/**
 * Get the interval abbreviation for a note relative to a root within a scale.
 * Returns the abbreviation string (e.g. "R", "m3", "P5") or empty string if
 * the note is not in the scale.
 */
export function getIntervalAbbreviation(note: string, root: string, scaleType: string): string {
  if (!isNoteInScale(note, root, scaleType)) return '';
  const semitones = getInterval(root, note);
  return INTERVAL_ABBREVIATIONS[semitones] ?? '';
}

/**
 * Get the scale degree label for a note relative to a root.
 * Returns the degree string (e.g. "1", "b3", "5") or empty string if
 * the note is not in the scale.
 */
export function getDegreeLabel(note: string, root: string, scaleType: string): string {
  if (!isNoteInScale(note, root, scaleType)) return '';
  const semitones = getInterval(root, note);
  return DEGREE_LABELS[semitones] ?? '';
}

/**
 * Get the scale degree number (1-indexed position within the scale) for a given semitone interval.
 * Returns the ordinal position: 1st, 2nd, 3rd, etc.
 * For example, in a major scale [0,2,4,5,7,9,11], semitone 4 (Major 3rd) is degree 3.
 */
export function getScaleDegreeNumber(semitones: number, scaleType: string): number {
  const formula = SCALE_FORMULAS[scaleType];
  if (!formula) return 0;
  const idx = formula.intervals.indexOf(semitones);
  return idx === -1 ? 0 : idx + 1;
}

/**
 * Get the interval formula for a scale as an array of abbreviations.
 * E.g., "Minor Pentatonic" -> ["R", "m3", "P4", "P5", "m7"]
 */
export function getScaleIntervalFormula(scaleType: string): string[] {
  const formula = SCALE_FORMULAS[scaleType];
  if (!formula || formula.intervals.length === 0) return [];
  return formula.intervals.map((semitones) => INTERVAL_ABBREVIATIONS[semitones] ?? '');
}

// ---------------------------------------------------------------------------
// Scale Degree Color Classification
// ---------------------------------------------------------------------------

/** The classification of a scale degree for coloring purposes. */
export type DegreeColorClass = 'root' | 'third' | 'fifth' | 'seventh' | 'other';

/**
 * Classify a note's role within a scale for degree-based coloring.
 * Returns: 'root' (1st), 'third' (3rd), 'fifth' (5th), 'seventh' (7th), or 'other'.
 */
export function getDegreeColorClass(note: string, root: string, scaleType: string): DegreeColorClass {
  const formula = SCALE_FORMULAS[scaleType];
  if (!formula || formula.intervals.length === 0) return 'other';

  const semitones = getInterval(root, note);
  const degreeIndex = formula.intervals.indexOf(semitones);
  if (degreeIndex === -1) return 'other';

  // Degree index is 0-based: 0=1st(root), 1=2nd, 2=3rd, 3=4th, 4=5th, 5=6th, 6=7th
  const degreeNumber = degreeIndex + 1;
  if (degreeNumber === 1) return 'root';
  if (degreeNumber === 3) return 'third';
  if (degreeNumber === 5) return 'fifth';
  if (degreeNumber === 7) return 'seventh';
  return 'other';
}

// ---------------------------------------------------------------------------
// Pentatonic Box Positions
// ---------------------------------------------------------------------------

/**
 * A pentatonic box position describes a fret range pattern relative to the root note.
 * The fretRange [low, high] is a relative offset from where the root falls on the
 * 6th string. The notes array contains [string, relativeFret] pairs for each note
 * in the position.
 *
 * These are the 5 classic CAGED pentatonic minor box shapes.
 */
export interface PentatonicBoxPosition {
  /** Position number (1-5). */
  position: number;
  /** Display name for this position. */
  name: string;
  /** Fret span relative to the root: [lowFret, highFret] offsets from root position on 6th string. */
  fretOffset: [number, number];
  /**
   * Notes in this position as [stringIndex (0=6th), fretOffset] pairs.
   * Fret offsets are relative to the root note on the 6th string.
   */
  notes: [number, number][];
}

/**
 * The 5 classic minor pentatonic box positions.
 * Fret offsets are relative to the root note on the 6th string.
 *
 * For example, if root = A (fret 5 on 6th string):
 * - Position 1 spans frets 5-8, Position 2 spans frets 8-10, etc.
 *
 * These wrap around (fret 0 / open string is equivalent to fret 12).
 */
export const MINOR_PENTATONIC_POSITIONS: PentatonicBoxPosition[] = [
  {
    position: 1,
    name: 'Position 1 (Root)',
    fretOffset: [0, 3],
    notes: [
      // String 6 (low E)
      [0, 0], [0, 3],
      // String 5 (A)
      [1, 0], [1, 2],
      // String 4 (D)
      [2, 0], [2, 2],
      // String 3 (G)
      [3, 0], [3, 2],
      // String 2 (B)
      [4, 0], [4, 3],
      // String 1 (high E)
      [5, 0], [5, 3],
    ],
  },
  {
    position: 2,
    name: 'Position 2',
    fretOffset: [3, 5],
    notes: [
      [0, 3], [0, 5],
      [1, 2], [1, 5],
      [2, 2], [2, 5],
      [3, 2], [3, 4],
      [4, 3], [4, 5],
      [5, 3], [5, 5],
    ],
  },
  {
    position: 3,
    name: 'Position 3',
    fretOffset: [5, 8],
    notes: [
      [0, 5], [0, 7],
      [1, 5], [1, 7],
      [2, 5], [2, 7],
      [3, 4], [3, 7],
      [4, 5], [4, 8],
      [5, 5], [5, 7],
    ],
  },
  {
    position: 4,
    name: 'Position 4',
    fretOffset: [7, 10],
    notes: [
      [0, 7], [0, 10],
      [1, 7], [1, 10],
      [2, 7], [2, 9],
      [3, 7], [3, 9],
      [4, 8], [4, 10],
      [5, 7], [5, 10],
    ],
  },
  {
    position: 5,
    name: 'Position 5',
    fretOffset: [10, 12],
    notes: [
      [0, 10], [0, 12],
      [1, 10], [1, 12],
      [2, 9], [2, 12],
      [3, 9], [3, 12],
      [4, 10], [4, 12],
      [5, 10], [5, 12],
    ],
  },
];

/**
 * The 5 classic major pentatonic box positions.
 * Since major pentatonic is the relative major of minor pentatonic,
 * the shapes are the same but shifted: major position 1 = minor position 2, etc.
 */
export const MAJOR_PENTATONIC_POSITIONS: PentatonicBoxPosition[] = [
  {
    position: 1,
    name: 'Position 1 (Root)',
    fretOffset: [0, 3],
    notes: [
      [0, 0], [0, 2],
      [1, 0], [1, 2],
      [2, -1], [2, 2],
      [3, -1], [3, 2],
      [4, 0], [4, 2],
      [5, 0], [5, 2],
    ],
  },
  {
    position: 2,
    name: 'Position 2',
    fretOffset: [2, 5],
    notes: [
      [0, 2], [0, 4],
      [1, 2], [1, 4],
      [2, 2], [2, 4],
      [3, 2], [3, 4],
      [4, 2], [4, 5],
      [5, 2], [5, 4],
    ],
  },
  {
    position: 3,
    name: 'Position 3',
    fretOffset: [4, 7],
    notes: [
      [0, 4], [0, 7],
      [1, 4], [1, 7],
      [2, 4], [2, 6],
      [3, 4], [3, 6],
      [4, 5], [4, 7],
      [5, 4], [5, 7],
    ],
  },
  {
    position: 4,
    name: 'Position 4',
    fretOffset: [7, 9],
    notes: [
      [0, 7], [0, 9],
      [1, 7], [1, 9],
      [2, 6], [2, 9],
      [3, 6], [3, 9],
      [4, 7], [4, 9],
      [5, 7], [5, 9],
    ],
  },
  {
    position: 5,
    name: 'Position 5',
    fretOffset: [9, 12],
    notes: [
      [0, 9], [0, 12],
      [1, 9], [1, 12],
      [2, 9], [2, 11],
      [3, 9], [3, 11],
      [4, 9], [4, 12],
      [5, 9], [5, 12],
    ],
  },
];

/**
 * Get the root note's fret position on the 6th string for a given root note.
 * Returns the fret number (0-11).
 */
export function getRootFretOn6thString(root: string): number {
  const rootIndex = getNoteIndex(root);
  // 6th string is tuned to E (index 4)
  return ((rootIndex - 4) + 12) % 12;
}

/**
 * Check if a given [stringIndex, fret] position is within a specific pentatonic box position
 * for a given root note.
 *
 * @param stringIndex - 0-based string index (0 = 6th string)
 * @param fret - absolute fret number on the guitar
 * @param root - root note name
 * @param boxPosition - the pentatonic box position data
 * @returns true if this fret/string position is one of the notes in the box
 */
export function isInPentatonicBox(
  stringIndex: number,
  fret: number,
  root: string,
  boxPosition: PentatonicBoxPosition,
): boolean {
  const rootFret = getRootFretOn6thString(root);

  for (const [noteString, noteOffset] of boxPosition.notes) {
    if (noteString !== stringIndex) continue;
    // Calculate absolute fret, wrapping at 12
    const absoluteFret = ((rootFret + noteOffset) % 12) || (noteOffset === 12 ? 12 : 0);
    // Check if this fret matches, considering octave equivalence
    if (fret === absoluteFret || fret === absoluteFret + 12 || fret === absoluteFret - 12) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Generic fret-window shapes (CAGED, 3NPS)
// ---------------------------------------------------------------------------

/**
 * A fret-window shape used for outlining a soloing box on the fretboard.
 * `fretOffset` is measured from where the root sits on the 6th string,
 * matching the anchoring convention used by `PentatonicBoxPosition`.
 */
export interface FretboardShape {
  /** 1-indexed position number. */
  position: number;
  /** Display label, e.g. "E shape" or "Ionian". */
  name: string;
  /** [lowFret, highFret] offsets from the 6th-string root fret. */
  fretOffset: [number, number];
}

/**
 * 5 CAGED positions for the major scale, offsets from the 6th-string root.
 * These describe rectangular fret windows; the notes inside are whatever
 * the current scale + root happen to contain.
 */
export const CAGED_POSITIONS: FretboardShape[] = [
  { position: 1, name: 'E shape',  fretOffset: [0, 3] },
  { position: 2, name: 'D shape',  fretOffset: [2, 5] },
  { position: 3, name: 'C shape',  fretOffset: [4, 7] },
  { position: 4, name: 'A shape',  fretOffset: [7, 10] },
  { position: 5, name: 'G shape',  fretOffset: [9, 12] },
];

/**
 * 7 three-note-per-string positions (one per mode of the major scale),
 * offsets from the 6th-string root.
 */
export const THREE_NPS_POSITIONS: FretboardShape[] = [
  { position: 1, name: 'Ionian',     fretOffset: [0, 4] },
  { position: 2, name: 'Dorian',     fretOffset: [2, 5] },
  { position: 3, name: 'Phrygian',   fretOffset: [4, 7] },
  { position: 4, name: 'Lydian',     fretOffset: [5, 9] },
  { position: 5, name: 'Mixolydian', fretOffset: [7, 10] },
  { position: 6, name: 'Aeolian',    fretOffset: [9, 12] },
  { position: 7, name: 'Locrian',    fretOffset: [11, 14] },
];

/**
 * Compute the absolute fret window for a shape given a root note.
 * If the root lands on fret 0 (open E), the window shifts up an octave
 * (+12) so it sits on the visible fretboard. `highFret` is clamped to 24.
 * Returns null if the shape falls entirely off the visible fretboard.
 */
export function getShapeFretWindow(
  shape: FretboardShape,
  rootNote: string,
): { lowFret: number; highFret: number } | null {
  let rootFret = getRootFretOn6thString(rootNote);
  let lowFret = rootFret + shape.fretOffset[0];
  let highFret = rootFret + shape.fretOffset[1];

  // Shift to an octave that fits on the fretboard.
  if (lowFret < 1) {
    lowFret += 12;
    highFret += 12;
  }

  if (lowFret > 24) return null;
  if (highFret > 24) highFret = 24;
  if (highFret < lowFret) return null;

  return { lowFret, highFret };
}
