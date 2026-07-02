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
  /** Volume 0-100 for click and note playback */
  volume: number;
  /** Speak the note name out loud when the cycle starts */
  voiceEnabled: boolean;
  /** Listen via microphone and auto-advance when the correct pitch class is played */
  listenEnabled: boolean;
  /** Stop the exercise after this many consecutive correct hits (0 = endless) */
  targetStreak: number;
}

export const DEFAULT_CONFIG: NoteTrainerConfig = {
  bpm: 120,
  notePool: 'natural',
  enabledStrings: [true, true, true, true, true, true],
  revealBeats: 2,
  volume: 50,
  voiceEnabled: true,
  listenEnabled: false,
  targetStreak: 14,
};

export type MicStatus = 'off' | 'requesting' | 'listening' | 'denied' | 'error';
