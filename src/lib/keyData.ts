/**
 * Shared key/scale data used by CircleOfFifths, ProgressionExplorer, etc.
 *
 * Contains diatonic chord data for all 24 major and minor keys,
 * circle-of-fifths ordering, and common chord progressions.
 */

// ---------------------------------------------------------------------------
// Circle of Fifths Key Order
// ---------------------------------------------------------------------------

/** Major keys in circle-of-fifths order (clockwise from C at 12 o'clock). */
export const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

/** Minor keys in circle-of-fifths order (clockwise from Am at 12 o'clock). */
export const MINOR_KEYS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

// ---------------------------------------------------------------------------
// Key Info
// ---------------------------------------------------------------------------

export interface KeyInfo {
  enharmonic?: string;
  relativeMinor?: string;
  relativeMajor?: string;
  signature: string;
  sharps: number;
  flats: number;
  scaleNotes: string[];
  diatonicChords: string[];
  chordQualities: string[];
}

export const KEY_DATA: Record<string, KeyInfo> = {
  // Major keys
  'C':  { relativeMinor: 'Am',  sharps: 0, flats: 0, signature: 'No sharps or flats',
           scaleNotes: ['C','D','E','F','G','A','B'],
           diatonicChords: ['C','Dm','Em','F','G','Am','Bdim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'G':  { relativeMinor: 'Em',  sharps: 1, flats: 0, signature: '1 sharp: F#',
           scaleNotes: ['G','A','B','C','D','E','F#'],
           diatonicChords: ['G','Am','Bm','C','D','Em','F#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'D':  { relativeMinor: 'Bm',  sharps: 2, flats: 0, signature: '2 sharps: F#, C#',
           scaleNotes: ['D','E','F#','G','A','B','C#'],
           diatonicChords: ['D','Em','F#m','G','A','Bm','C#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'A':  { relativeMinor: 'F#m', sharps: 3, flats: 0, signature: '3 sharps: F#, C#, G#',
           scaleNotes: ['A','B','C#','D','E','F#','G#'],
           diatonicChords: ['A','Bm','C#m','D','E','F#m','G#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'E':  { relativeMinor: 'C#m', sharps: 4, flats: 0, signature: '4 sharps: F#, C#, G#, D#',
           scaleNotes: ['E','F#','G#','A','B','C#','D#'],
           diatonicChords: ['E','F#m','G#m','A','B','C#m','D#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'B':  { relativeMinor: 'G#m', sharps: 5, flats: 0, signature: '5 sharps: F#, C#, G#, D#, A#',
           scaleNotes: ['B','C#','D#','E','F#','G#','A#'],
           diatonicChords: ['B','C#m','D#m','E','F#','G#m','A#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Gb': { enharmonic: 'F#', relativeMinor: 'Ebm', sharps: 0, flats: 6, signature: '6 flats: Bb, Eb, Ab, Db, Gb, Cb',
           scaleNotes: ['Gb','Ab','Bb','Cb','Db','Eb','F'],
           diatonicChords: ['Gb','Abm','Bbm','Cb','Db','Ebm','Fdim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Db': { enharmonic: 'C#', relativeMinor: 'Bbm', sharps: 0, flats: 5, signature: '5 flats: Bb, Eb, Ab, Db, Gb',
           scaleNotes: ['Db','Eb','F','Gb','Ab','Bb','C'],
           diatonicChords: ['Db','Ebm','Fm','Gb','Ab','Bbm','Cdim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Ab': { relativeMinor: 'Fm',  sharps: 0, flats: 4, signature: '4 flats: Bb, Eb, Ab, Db',
           scaleNotes: ['Ab','Bb','C','Db','Eb','F','G'],
           diatonicChords: ['Ab','Bbm','Cm','Db','Eb','Fm','Gdim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Eb': { relativeMinor: 'Cm',  sharps: 0, flats: 3, signature: '3 flats: Bb, Eb, Ab',
           scaleNotes: ['Eb','F','G','Ab','Bb','C','D'],
           diatonicChords: ['Eb','Fm','Gm','Ab','Bb','Cm','Ddim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Bb': { relativeMinor: 'Gm',  sharps: 0, flats: 2, signature: '2 flats: Bb, Eb',
           scaleNotes: ['Bb','C','D','Eb','F','G','A'],
           diatonicChords: ['Bb','Cm','Dm','Eb','F','Gm','Adim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'F':  { relativeMinor: 'Dm',  sharps: 0, flats: 1, signature: '1 flat: Bb',
           scaleNotes: ['F','G','A','Bb','C','D','E'],
           diatonicChords: ['F','Gm','Am','Bb','C','Dm','Edim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  // Minor keys (natural minor / Aeolian)
  'Am':  { relativeMajor: 'C',  sharps: 0, flats: 0, signature: 'No sharps or flats',
            scaleNotes: ['A','B','C','D','E','F','G'],
            diatonicChords: ['Am','Bdim','C','Dm','Em','F','G'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Em':  { relativeMajor: 'G',  sharps: 1, flats: 0, signature: '1 sharp: F#',
            scaleNotes: ['E','F#','G','A','B','C','D'],
            diatonicChords: ['Em','F#dim','G','Am','Bm','C','D'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Bm':  { relativeMajor: 'D',  sharps: 2, flats: 0, signature: '2 sharps: F#, C#',
            scaleNotes: ['B','C#','D','E','F#','G','A'],
            diatonicChords: ['Bm','C#dim','D','Em','F#m','G','A'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'F#m': { relativeMajor: 'A',  sharps: 3, flats: 0, signature: '3 sharps: F#, C#, G#',
            scaleNotes: ['F#','G#','A','B','C#','D','E'],
            diatonicChords: ['F#m','G#dim','A','Bm','C#m','D','E'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'C#m': { relativeMajor: 'E',  sharps: 4, flats: 0, signature: '4 sharps: F#, C#, G#, D#',
            scaleNotes: ['C#','D#','E','F#','G#','A','B'],
            diatonicChords: ['C#m','D#dim','E','F#m','G#m','A','B'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'G#m': { enharmonic: 'Abm', relativeMajor: 'B', sharps: 5, flats: 0, signature: '5 sharps: F#, C#, G#, D#, A#',
            scaleNotes: ['G#','A#','B','C#','D#','E','F#'],
            diatonicChords: ['G#m','A#dim','B','C#m','D#m','E','F#'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Ebm': { enharmonic: 'D#m', relativeMajor: 'Gb', sharps: 0, flats: 6, signature: '6 flats: Bb, Eb, Ab, Db, Gb, Cb',
            scaleNotes: ['Eb','F','Gb','Ab','Bb','Cb','Db'],
            diatonicChords: ['Ebm','Fdim','Gb','Abm','Bbm','Cb','Db'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Bbm': { relativeMajor: 'Db', sharps: 0, flats: 5, signature: '5 flats: Bb, Eb, Ab, Db, Gb',
            scaleNotes: ['Bb','C','Db','Eb','F','Gb','Ab'],
            diatonicChords: ['Bbm','Cdim','Db','Ebm','Fm','Gb','Ab'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Fm':  { relativeMajor: 'Ab', sharps: 0, flats: 4, signature: '4 flats: Bb, Eb, Ab, Db',
            scaleNotes: ['F','G','Ab','Bb','C','Db','Eb'],
            diatonicChords: ['Fm','Gdim','Ab','Bbm','Cm','Db','Eb'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Cm':  { relativeMajor: 'Eb', sharps: 0, flats: 3, signature: '3 flats: Bb, Eb, Ab',
            scaleNotes: ['C','D','Eb','F','G','Ab','Bb'],
            diatonicChords: ['Cm','Ddim','Eb','Fm','Gm','Ab','Bb'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Gm':  { relativeMajor: 'Bb', sharps: 0, flats: 2, signature: '2 flats: Bb, Eb',
            scaleNotes: ['G','A','Bb','C','D','Eb','F'],
            diatonicChords: ['Gm','Adim','Bb','Cm','Dm','Eb','F'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Dm':  { relativeMajor: 'F',  sharps: 0, flats: 1, signature: '1 flat: Bb',
            scaleNotes: ['D','E','F','G','A','Bb','C'],
            diatonicChords: ['Dm','Edim','F','Gm','Am','Bb','C'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
};

// ---------------------------------------------------------------------------
// Common Progressions
// ---------------------------------------------------------------------------

export interface CommonProgression {
  name: string;
  indices: number[];
  label: string;
}

export const COMMON_PROGRESSIONS: CommonProgression[] = [
  { name: 'I - IV - V - I',        indices: [0, 3, 4, 0],  label: 'Classic' },
  { name: 'I - V - vi - IV',       indices: [0, 4, 5, 3],  label: 'Pop' },
  { name: 'I - vi - IV - V',       indices: [0, 5, 3, 4],  label: '50s' },
  { name: 'ii - V - I',            indices: [1, 4, 0],      label: 'Jazz' },
  { name: 'I - IV - vi - V',       indices: [0, 3, 5, 4],  label: 'Alternative' },
  { name: 'vi - IV - I - V',       indices: [5, 3, 0, 4],  label: 'Minor Feel' },
  { name: 'I - V - vi - iii - IV', indices: [0, 4, 5, 2, 3], label: 'Canon' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isMajorKey(key: string): boolean {
  return MAJOR_KEYS.includes(key);
}
