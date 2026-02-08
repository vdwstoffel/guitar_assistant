/**
 * Guitar chord voicing definitions.
 *
 * Each voicing describes how a chord is physically played on the guitar:
 * fret positions, finger assignments, starting position, and optional barre.
 *
 * Strings are ordered low E (6th) to high E (1st), matching STANDARD_TUNING.
 * A `null` fret means the string is muted (not played).
 * A fret of 0 means the string is played open.
 * Finger 0 = open string, null = not played.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BarreInfo {
  /** Fret number where the barre is placed */
  fret: number;
  /** String index to start barre (0 = 6th string) */
  fromString: number;
  /** String index to end barre (5 = 1st string) */
  toString: number;
}

export interface ChordVoicing {
  /** Root note name, e.g. "C" */
  root: string;
  /** Chord quality matching CHORD_FORMULAS keys, e.g. "Major" */
  type: string;
  /** 6 elements (low E to high E). null = muted, 0 = open, 1+ = fretted */
  frets: (number | null)[];
  /** Finger numbers 1-4. null = not played, 0 = open string */
  fingers: (number | null)[];
  /** Starting fret for diagram display (0 for open position chords) */
  position: number;
  /** Optional barre information */
  barreInfo?: BarreInfo;
  /** Optional display name override, e.g. "Open C", "Barre A shape" */
  name?: string;
}

// ---------------------------------------------------------------------------
// Voicing data
// ---------------------------------------------------------------------------

export const CHORD_VOICINGS: ChordVoicing[] = [
  // ==========================================================================
  // OPEN MAJOR CHORDS (CAGED shapes)
  // ==========================================================================
  {
    root: 'C', type: 'Major', name: 'Open C',
    frets:   [null, 3, 2, 0, 1, 0],
    fingers: [null, 3, 2, 0, 1, 0],
    position: 0,
  },
  {
    root: 'A', type: 'Major', name: 'Open A',
    frets:   [null, 0, 2, 2, 2, 0],
    fingers: [null, 0, 1, 2, 3, 0],
    position: 0,
  },
  {
    root: 'G', type: 'Major', name: 'Open G',
    frets:   [3, 2, 0, 0, 0, 3],
    fingers: [2, 1, 0, 0, 0, 3],
    position: 0,
  },
  {
    root: 'E', type: 'Major', name: 'Open E',
    frets:   [0, 2, 2, 1, 0, 0],
    fingers: [0, 2, 3, 1, 0, 0],
    position: 0,
  },
  {
    root: 'D', type: 'Major', name: 'Open D',
    frets:   [null, null, 0, 2, 3, 2],
    fingers: [null, null, 0, 1, 3, 2],
    position: 0,
  },

  // ==========================================================================
  // OPEN MINOR CHORDS
  // ==========================================================================
  {
    root: 'A', type: 'Minor', name: 'Open Am',
    frets:   [null, 0, 2, 2, 1, 0],
    fingers: [null, 0, 2, 3, 1, 0],
    position: 0,
  },
  {
    root: 'E', type: 'Minor', name: 'Open Em',
    frets:   [0, 2, 2, 0, 0, 0],
    fingers: [0, 2, 3, 0, 0, 0],
    position: 0,
  },
  {
    root: 'D', type: 'Minor', name: 'Open Dm',
    frets:   [null, null, 0, 2, 3, 1],
    fingers: [null, null, 0, 2, 3, 1],
    position: 0,
  },

  // ==========================================================================
  // BARRE MAJOR CHORDS
  // ==========================================================================
  {
    root: 'F', type: 'Major', name: 'F Barre (E shape)',
    frets:   [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    position: 1,
    barreInfo: { fret: 1, fromString: 0, toString: 5 },
  },
  {
    root: 'A#', type: 'Major', name: 'Bb Barre (A shape)',
    frets:   [null, 1, 3, 3, 3, 1],
    fingers: [null, 1, 2, 3, 4, 1],
    position: 1,
    barreInfo: { fret: 1, fromString: 1, toString: 5 },
  },
  {
    root: 'B', type: 'Major', name: 'B Barre (A shape)',
    frets:   [null, 2, 4, 4, 4, 2],
    fingers: [null, 1, 2, 3, 4, 1],
    position: 2,
    barreInfo: { fret: 2, fromString: 1, toString: 5 },
  },

  // ==========================================================================
  // BARRE MINOR CHORDS
  // ==========================================================================
  {
    root: 'F', type: 'Minor', name: 'Fm Barre (Em shape)',
    frets:   [1, 3, 3, 1, 1, 1],
    fingers: [1, 3, 4, 1, 1, 1],
    position: 1,
    barreInfo: { fret: 1, fromString: 0, toString: 5 },
  },
  {
    root: 'B', type: 'Minor', name: 'Bm Barre (Am shape)',
    frets:   [null, 2, 4, 4, 3, 2],
    fingers: [null, 1, 3, 4, 2, 1],
    position: 2,
    barreInfo: { fret: 2, fromString: 1, toString: 5 },
  },

  // ==========================================================================
  // POWER CHORDS
  // ==========================================================================
  {
    root: 'E', type: 'Power', name: 'E5 (6th string root)',
    frets:   [0, 2, 2, null, null, null],
    fingers: [0, 1, 2, null, null, null],
    position: 0,
  },
  {
    root: 'A', type: 'Power', name: 'A5 (5th string root)',
    frets:   [null, 0, 2, 2, null, null],
    fingers: [null, 0, 1, 2, null, null],
    position: 0,
  },
  {
    root: 'G', type: 'Power', name: 'G5 (6th string root)',
    frets:   [3, 5, 5, null, null, null],
    fingers: [1, 3, 4, null, null, null],
    position: 3,
  },
  {
    root: 'D', type: 'Power', name: 'D5 (5th string root)',
    frets:   [null, 5, 7, 7, null, null],
    fingers: [null, 1, 3, 4, null, null],
    position: 5,
  },

  // ==========================================================================
  // DOMINANT 7th CHORDS
  // ==========================================================================
  {
    root: 'A', type: 'Dom7', name: 'A7',
    frets:   [null, 0, 2, 0, 2, 0],
    fingers: [null, 0, 2, 0, 3, 0],
    position: 0,
  },
  {
    root: 'E', type: 'Dom7', name: 'E7',
    frets:   [0, 2, 0, 1, 0, 0],
    fingers: [0, 2, 0, 1, 0, 0],
    position: 0,
  },
  {
    root: 'D', type: 'Dom7', name: 'D7',
    frets:   [null, null, 0, 2, 1, 2],
    fingers: [null, null, 0, 2, 1, 3],
    position: 0,
  },
  {
    root: 'G', type: 'Dom7', name: 'G7',
    frets:   [3, 2, 0, 0, 0, 1],
    fingers: [3, 2, 0, 0, 0, 1],
    position: 0,
  },
  {
    root: 'B', type: 'Dom7', name: 'B7',
    frets:   [null, 2, 1, 2, 0, 2],
    fingers: [null, 2, 1, 3, 0, 4],
    position: 0,
  },
  {
    root: 'C', type: 'Dom7', name: 'C7',
    frets:   [null, 3, 2, 3, 1, 0],
    fingers: [null, 3, 2, 4, 1, 0],
    position: 0,
  },

  // ==========================================================================
  // MINOR 7th CHORDS
  // ==========================================================================
  {
    root: 'A', type: 'Min7', name: 'Am7',
    frets:   [null, 0, 2, 0, 1, 0],
    fingers: [null, 0, 2, 0, 1, 0],
    position: 0,
  },
  {
    root: 'E', type: 'Min7', name: 'Em7',
    frets:   [0, 2, 0, 0, 0, 0],
    fingers: [0, 2, 0, 0, 0, 0],
    position: 0,
  },
  {
    root: 'D', type: 'Min7', name: 'Dm7',
    frets:   [null, null, 0, 2, 1, 1],
    fingers: [null, null, 0, 2, 1, 1],
    position: 0,
  },

  // ==========================================================================
  // MAJOR 7th CHORDS
  // ==========================================================================
  {
    root: 'C', type: 'Maj7', name: 'Cmaj7',
    frets:   [null, 3, 2, 0, 0, 0],
    fingers: [null, 3, 2, 0, 0, 0],
    position: 0,
  },
  {
    root: 'F', type: 'Maj7', name: 'Fmaj7',
    frets:   [null, null, 3, 2, 1, 0],
    fingers: [null, null, 3, 2, 1, 0],
    position: 0,
  },
  {
    root: 'G', type: 'Maj7', name: 'Gmaj7',
    frets:   [3, 2, 0, 0, 0, 2],
    fingers: [2, 1, 0, 0, 0, 3],
    position: 0,
  },
  {
    root: 'A', type: 'Maj7', name: 'Amaj7',
    frets:   [null, 0, 2, 1, 2, 0],
    fingers: [null, 0, 2, 1, 3, 0],
    position: 0,
  },
  {
    root: 'D', type: 'Maj7', name: 'Dmaj7',
    frets:   [null, null, 0, 2, 2, 2],
    fingers: [null, null, 0, 1, 2, 3],
    position: 0,
  },

  // ==========================================================================
  // SUS2 CHORDS
  // ==========================================================================
  {
    root: 'A', type: 'Sus2', name: 'Asus2',
    frets:   [null, 0, 2, 2, 0, 0],
    fingers: [null, 0, 1, 2, 0, 0],
    position: 0,
  },
  {
    root: 'D', type: 'Sus2', name: 'Dsus2',
    frets:   [null, null, 0, 2, 3, 0],
    fingers: [null, null, 0, 1, 3, 0],
    position: 0,
  },
  {
    root: 'E', type: 'Sus2', name: 'Esus2',
    frets:   [0, 2, 4, 4, 0, 0],
    fingers: [0, 1, 3, 4, 0, 0],
    position: 0,
  },

  // ==========================================================================
  // SUS4 CHORDS
  // ==========================================================================
  {
    root: 'A', type: 'Sus4', name: 'Asus4',
    frets:   [null, 0, 2, 2, 3, 0],
    fingers: [null, 0, 1, 2, 3, 0],
    position: 0,
  },
  {
    root: 'D', type: 'Sus4', name: 'Dsus4',
    frets:   [null, null, 0, 2, 3, 3],
    fingers: [null, null, 0, 1, 2, 3],
    position: 0,
  },
  {
    root: 'E', type: 'Sus4', name: 'Esus4',
    frets:   [0, 2, 2, 2, 0, 0],
    fingers: [0, 2, 3, 4, 0, 0],
    position: 0,
  },

  // ==========================================================================
  // ADDITIONAL COMMON VOICINGS (extra shapes for common roots)
  // ==========================================================================
  {
    root: 'C', type: 'Minor', name: 'Cm Barre (Am shape)',
    frets:   [null, 3, 5, 5, 4, 3],
    fingers: [null, 1, 3, 4, 2, 1],
    position: 3,
    barreInfo: { fret: 3, fromString: 1, toString: 5 },
  },
  {
    root: 'G', type: 'Minor', name: 'Gm Barre (Em shape)',
    frets:   [3, 5, 5, 3, 3, 3],
    fingers: [1, 3, 4, 1, 1, 1],
    position: 3,
    barreInfo: { fret: 3, fromString: 0, toString: 5 },
  },
  {
    root: 'C', type: 'Major', name: 'C Barre (A shape)',
    frets:   [null, 3, 5, 5, 5, 3],
    fingers: [null, 1, 2, 3, 4, 1],
    position: 3,
    barreInfo: { fret: 3, fromString: 1, toString: 5 },
  },
  {
    root: 'A', type: 'Major', name: 'A Barre (E shape)',
    frets:   [5, 7, 7, 6, 5, 5],
    fingers: [1, 3, 4, 2, 1, 1],
    position: 5,
    barreInfo: { fret: 5, fromString: 0, toString: 5 },
  },
  {
    root: 'D', type: 'Major', name: 'D Barre (A shape)',
    frets:   [null, 5, 7, 7, 7, 5],
    fingers: [null, 1, 2, 3, 4, 1],
    position: 5,
    barreInfo: { fret: 5, fromString: 1, toString: 5 },
  },
  {
    root: 'E', type: 'Major', name: 'E Barre (D shape)',
    frets:   [null, null, 2, 4, 5, 4],
    fingers: [null, null, 1, 2, 4, 3],
    position: 2,
  },
  {
    root: 'G', type: 'Major', name: 'G Barre (E shape)',
    frets:   [3, 5, 5, 4, 3, 3],
    fingers: [1, 3, 4, 2, 1, 1],
    position: 3,
    barreInfo: { fret: 3, fromString: 0, toString: 5 },
  },
  {
    root: 'A', type: 'Minor', name: 'Am Barre (Em shape)',
    frets:   [5, 7, 7, 5, 5, 5],
    fingers: [1, 3, 4, 1, 1, 1],
    position: 5,
    barreInfo: { fret: 5, fromString: 0, toString: 5 },
  },
  {
    root: 'D', type: 'Minor', name: 'Dm Barre (Am shape)',
    frets:   [null, 5, 7, 7, 6, 5],
    fingers: [null, 1, 3, 4, 2, 1],
    position: 5,
    barreInfo: { fret: 5, fromString: 1, toString: 5 },
  },
  {
    root: 'E', type: 'Minor', name: 'Em Barre (Dm shape)',
    frets:   [null, null, 2, 4, 5, 3],
    fingers: [null, null, 1, 3, 4, 2],
    position: 2,
  },

  // ==========================================================================
  // DIMINISHED
  // ==========================================================================
  {
    root: 'B', type: 'Diminished', name: 'Bdim',
    frets:   [null, 2, 3, 4, 3, null],
    fingers: [null, 1, 2, 4, 3, null],
    position: 2,
  },

  // ==========================================================================
  // AUGMENTED
  // ==========================================================================
  {
    root: 'C', type: 'Augmented', name: 'Caug',
    frets:   [null, 3, 2, 1, 1, 0],
    fingers: [null, 4, 3, 1, 2, 0],
    position: 0,
  },

  // ==========================================================================
  // ADD9
  // ==========================================================================
  {
    root: 'C', type: 'Add9', name: 'Cadd9',
    frets:   [null, 3, 2, 0, 3, 0],
    fingers: [null, 2, 1, 0, 3, 0],
    position: 0,
  },
  {
    root: 'G', type: 'Add9', name: 'Gadd9',
    frets:   [3, 0, 0, 0, 0, 3],
    fingers: [2, 0, 0, 0, 0, 3],
    position: 0,
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Get all voicings for a given root + chord type combination.
 * Returns an empty array if no voicings are found.
 */
export function getVoicingsForChord(root: string, type: string): ChordVoicing[] {
  return CHORD_VOICINGS.filter((v) => v.root === root && v.type === type);
}

/**
 * Get all unique chord types that have at least one voicing for a given root.
 */
export function getAvailableTypesForRoot(root: string): string[] {
  const types = new Set<string>();
  for (const v of CHORD_VOICINGS) {
    if (v.root === root) {
      types.add(v.type);
    }
  }
  return Array.from(types);
}
