/** Types and constants for the IntervalExplorer feature. */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A position on the fretboard identified by string and fret number. */
export interface FretPosition {
  /** 0 = 6th (low E) string, 5 = 1st (high E) string */
  string: number;
  /** 0 = open string, 1-15 = fretted positions */
  fret: number;
}

/** Data for a single interval in the reference panel. */
export interface IntervalInfo {
  /** Human-readable name (e.g., "Minor 3rd") */
  name: string;
  /** Number of semitones from the root */
  semitones: number;
  /** Short abbreviation (e.g., "m3") */
  abbreviation: string;
  /** Quality category */
  quality: 'perfect' | 'major' | 'minor' | 'tritone';
  /** Description of how it sounds */
  soundDescription: string;
  /** Famous song example (first two notes) */
  songExample: string;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

/**
 * Complete reference data for all 13 intervals (unison through octave).
 * Song examples use the first two notes of well-known melodies.
 */
export const INTERVAL_REFERENCE: IntervalInfo[] = [
  {
    name: 'Unison',
    semitones: 0,
    abbreviation: 'P1',
    quality: 'perfect',
    soundDescription: 'Same note, no movement',
    songExample: '',
  },
  {
    name: 'Minor 2nd',
    semitones: 1,
    abbreviation: 'm2',
    quality: 'minor',
    soundDescription: 'Tense, dissonant, suspenseful',
    songExample: 'Jaws theme',
  },
  {
    name: 'Major 2nd',
    semitones: 2,
    abbreviation: 'M2',
    quality: 'major',
    soundDescription: 'Neutral, stepping, scalar',
    songExample: 'Happy Birthday',
  },
  {
    name: 'Minor 3rd',
    semitones: 3,
    abbreviation: 'm3',
    quality: 'minor',
    soundDescription: 'Sad, dark, melancholic',
    songExample: 'Smoke on the Water',
  },
  {
    name: 'Major 3rd',
    semitones: 4,
    abbreviation: 'M3',
    quality: 'major',
    soundDescription: 'Happy, bright, cheerful',
    songExample: 'When the Saints Go Marching In',
  },
  {
    name: 'Perfect 4th',
    semitones: 5,
    abbreviation: 'P4',
    quality: 'perfect',
    soundDescription: 'Open, resolved, strong',
    songExample: 'Here Comes the Bride',
  },
  {
    name: 'Tritone',
    semitones: 6,
    abbreviation: 'TT',
    quality: 'tritone',
    soundDescription: 'Unstable, restless, eerie',
    songExample: 'The Simpsons theme',
  },
  {
    name: 'Perfect 5th',
    semitones: 7,
    abbreviation: 'P5',
    quality: 'perfect',
    soundDescription: 'Open, powerful, stable',
    songExample: 'Star Wars main theme',
  },
  {
    name: 'Minor 6th',
    semitones: 8,
    abbreviation: 'm6',
    quality: 'minor',
    soundDescription: 'Dramatic, yearning, bittersweet',
    songExample: 'The Entertainer',
  },
  {
    name: 'Major 6th',
    semitones: 9,
    abbreviation: 'M6',
    quality: 'major',
    soundDescription: 'Warm, sweet, nostalgic',
    songExample: 'My Bonnie Lies Over the Ocean',
  },
  {
    name: 'Minor 7th',
    semitones: 10,
    abbreviation: 'm7',
    quality: 'minor',
    soundDescription: 'Bluesy, funky, unresolved',
    songExample: 'Somewhere (West Side Story)',
  },
  {
    name: 'Major 7th',
    semitones: 11,
    abbreviation: 'M7',
    quality: 'major',
    soundDescription: 'Dreamy, jazzy, longing',
    songExample: 'Take On Me',
  },
  {
    name: 'Octave',
    semitones: 12,
    abbreviation: 'P8',
    quality: 'perfect',
    soundDescription: 'Same note, higher pitch',
    songExample: 'Somewhere Over the Rainbow',
  },
];
