export type TrainerPhase = 'idle' | 'counting' | 'revealing';

export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

export interface NoteTrainerConfig {
  bpm: number;
  /** Which of the 12 chromatic notes to quiz */
  notePool: 'natural' | 'all';
  /** Per-string enable/disable, indexed 0=low E … 5=high E */
  enabledStrings: boolean[];
  /** How many beats to hold the reveal (at current BPM) */
  revealBeats: number;
}

export const DEFAULT_CONFIG: NoteTrainerConfig = {
  bpm: 60,
  notePool: 'natural',
  enabledStrings: [true, true, true, true, true, true],
  revealBeats: 2,
};
