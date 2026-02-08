/**
 * Types and constants for the ChordBuilder feature.
 *
 * Re-exports ChordVoicing from the shared voicings library and defines
 * UI-specific types for chord selection, display names, and grouping.
 */

export type { ChordVoicing, BarreInfo } from '@/lib/chordVoicings';

// ---------------------------------------------------------------------------
// Chord type grouping for the selector UI
// ---------------------------------------------------------------------------

/** A group of chord types displayed together in the selector. */
export interface ChordTypeGroup {
  label: string;
  types: ChordTypeEntry[];
}

/** A single chord type entry with its formula key and display label. */
export interface ChordTypeEntry {
  /** Key into CHORD_FORMULAS (e.g. "Major", "Dom7") */
  key: string;
  /** Short display label for buttons (e.g. "Maj", "m7") */
  label: string;
}

/**
 * Grouped chord types for the selector panel.
 * Organized by category so beginners can find what they need quickly.
 */
export const CHORD_TYPE_GROUPS: ChordTypeGroup[] = [
  {
    label: 'Triads',
    types: [
      { key: 'Major', label: 'Major' },
      { key: 'Minor', label: 'Minor' },
      { key: 'Diminished', label: 'Dim' },
      { key: 'Augmented', label: 'Aug' },
    ],
  },
  {
    label: '7ths',
    types: [
      { key: 'Dom7', label: '7' },
      { key: 'Maj7', label: 'Maj7' },
      { key: 'Min7', label: 'm7' },
    ],
  },
  {
    label: 'Suspended',
    types: [
      { key: 'Sus2', label: 'Sus2' },
      { key: 'Sus4', label: 'Sus4' },
    ],
  },
  {
    label: 'Other',
    types: [
      { key: 'Power', label: '5' },
      { key: 'Add9', label: 'Add9' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Display name helpers
// ---------------------------------------------------------------------------

/** Interval abbreviation map for chord tone display. */
export const INTERVAL_ABBREVIATIONS: Record<number, string> = {
  0: 'R',
  1: 'b2',
  2: '2',
  3: 'b3',
  4: '3',
  5: '4',
  6: 'b5',
  7: '5',
  8: '#5',
  9: '6',
  10: 'b7',
  11: '7',
  12: '8',
  14: '9',
};

/**
 * Get the standard chord symbol for a root + type combination.
 * E.g., ("C", "Major") -> "C", ("A", "Minor") -> "Am", ("G", "Dom7") -> "G7"
 */
export function getChordSymbol(root: string, type: string): string {
  const suffixes: Record<string, string> = {
    'Major': '',
    'Minor': 'm',
    'Diminished': 'dim',
    'Augmented': 'aug',
    'Sus2': 'sus2',
    'Sus4': 'sus4',
    'Dom7': '7',
    'Maj7': 'maj7',
    'Min7': 'm7',
    'MinMaj7': 'm(maj7)',
    'Dim7': 'dim7',
    'HalfDim7': 'm7b5',
    'Aug7': 'aug7',
    'Dom9': '9',
    'Maj9': 'maj9',
    'Min9': 'm9',
    'Add9': 'add9',
    'Power': '5',
  };
  return root + (suffixes[type] ?? type);
}
