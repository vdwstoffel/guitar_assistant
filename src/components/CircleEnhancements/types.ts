/** Types and constants for the Circle of Fifths enhancements. */

// ---------------------------------------------------------------------------
// Notation Mode
// ---------------------------------------------------------------------------

/** Display mode for chord progression notation. */
export type NotationMode = 'roman' | 'nashville';

// ---------------------------------------------------------------------------
// Progression Types
// ---------------------------------------------------------------------------

/** A single chord in a progression, linking a diatonic index to display info. */
export interface ProgressionChord {
  /** Index into the diatonic chords array (0-6). */
  diatonicIndex: number;
  /** The actual chord name (e.g. "Am", "F", "G7"). */
  chordName: string;
  /** Roman numeral quality label (e.g. "I", "ii", "vi"). */
  romanNumeral: string;
  /** Nashville number label (e.g. "1", "2", "6"). */
  nashvilleNumber: string;
}

// ---------------------------------------------------------------------------
// Nashville Number Mapping
// ---------------------------------------------------------------------------

/**
 * Map Roman numeral qualities to Nashville numbers.
 * Major keys: I, ii, iii, IV, V, vi, vii deg.
 * Minor keys: i, ii deg, III, iv, v, VI, VII.
 */
export const ROMAN_TO_NASHVILLE_MAJOR: Record<string, string> = {
  'I': '1',
  'ii': '2',
  'iii': '3',
  'IV': '4',
  'V': '5',
  'vi': '6',
  'vii\u00B0': '7',
};

export const ROMAN_TO_NASHVILLE_MINOR: Record<string, string> = {
  'i': '1',
  'ii\u00B0': '2',
  'III': '3',
  'iv': '4',
  'v': '5',
  'VI': '6',
  'VII': '7',
};

// ---------------------------------------------------------------------------
// Flat-to-Sharp Enharmonic Map
// ---------------------------------------------------------------------------

/**
 * Maps flat-based note names to their sharp-based equivalents for lookup
 * in musicTheory.ts functions (which use sharps only).
 * Only entries that differ are included; notes that are the same (C, D, E, etc.)
 * don't need mapping.
 */
export const FLAT_TO_SHARP: Record<string, string> = {
  'Cb': 'B',
  'Db': 'C#',
  'Eb': 'D#',
  'Fb': 'E',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#',
};

/**
 * Convert a chord name from flat-based spelling to sharp-based spelling.
 * Handles chords like "Bbm", "Ebdim", "Gb" by converting the root note
 * while preserving the quality suffix (m, dim, etc.).
 */
export function chordRootToSharp(chordName: string): string {
  // Try two-character root first (e.g., "Bb", "Eb", "Ab")
  const twoCharRoot = chordName.slice(0, 2);
  if (FLAT_TO_SHARP[twoCharRoot]) {
    return FLAT_TO_SHARP[twoCharRoot] + chordName.slice(2);
  }
  // Single-character root (e.g., "C", "G")
  return chordName;
}

/**
 * Extract the root note from a chord name, converted to sharp-based spelling.
 * "Bbm" -> "A#", "F#dim" -> "F#", "C" -> "C"
 */
export function getSharpRoot(chordName: string): string {
  // Check for two-character root with flat
  const twoCharRoot = chordName.slice(0, 2);
  if (FLAT_TO_SHARP[twoCharRoot]) {
    return FLAT_TO_SHARP[twoCharRoot];
  }
  // Check for two-character root with sharp
  if (chordName.length >= 2 && chordName[1] === '#') {
    return chordName.slice(0, 2);
  }
  // Single-character root
  return chordName[0];
}

/**
 * Determine the chord quality (formula key in CHORD_FORMULAS) from a chord name.
 * "C" -> "Major", "Am" -> "Minor", "Bdim" -> "Diminished", "F#m" -> "Minor"
 */
export function getChordQuality(chordName: string): string {
  // Determine root length (1 or 2 characters)
  let rootLen = 1;
  const twoChar = chordName.slice(0, 2);
  if (FLAT_TO_SHARP[twoChar] || (twoChar.length === 2 && twoChar[1] === '#')) {
    rootLen = 2;
  }
  const qualitySuffix = chordName.slice(rootLen);

  if (qualitySuffix === 'dim') return 'Diminished';
  if (qualitySuffix === 'm') return 'Minor';
  if (qualitySuffix === '') return 'Major';
  // Fallback
  return 'Major';
}
