/**
 * Web Audio API utilities for playing notes, intervals, and chords.
 *
 * Uses a shared AudioContext singleton (same pattern as clickGenerator.ts).
 * All frequencies are calculated from the equal temperament formula:
 *   frequency = 440 * 2^((midiNote - 69) / 12)
 *
 * where A4 (MIDI 69) = 440 Hz.
 */

import { NOTES, getNoteIndex } from './musicTheory';

// ---------------------------------------------------------------------------
// AudioContext singleton
// ---------------------------------------------------------------------------

let audioContext: AudioContext | null = null;

/**
 * Get or create a shared AudioContext.
 * Automatically resumes a suspended context (required after user gesture).
 */
export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// ---------------------------------------------------------------------------
// Frequency conversion
// ---------------------------------------------------------------------------

/**
 * Convert a note name + octave to frequency in Hz.
 *
 * Uses equal temperament: 440 * 2^((midiNote - 69) / 12)
 * where midiNote = (octave + 1) * 12 + chromaticIndex.
 *
 * Examples:
 *   noteToFrequency("A", 4) => 440
 *   noteToFrequency("C", 4) => ~261.63
 *   noteToFrequency("E", 2) => ~82.41
 */
export function noteToFrequency(note: string, octave: number): number {
  const chromaticIndex = getNoteIndex(note);
  if (chromaticIndex === -1) {
    throw new Error(`Unknown note name: "${note}". Expected one of: ${NOTES.join(', ')}`);
  }
  // MIDI note number: C-1 = 0, C4 = 60, A4 = 69
  const midiNote = (octave + 1) * 12 + chromaticIndex;
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// ---------------------------------------------------------------------------
// Playback functions
// ---------------------------------------------------------------------------

/** Default duration for a single note in seconds. */
const DEFAULT_DURATION = 0.5;
/** Default octave when not specified. */
const DEFAULT_OCTAVE = 4;
/** Default waveform. Triangle gives a warm, guitar-like tone. */
const DEFAULT_WAVEFORM: OscillatorType = 'triangle';

/**
 * Play a single tone at the given frequency.
 *
 * @param frequency - frequency in Hz
 * @param duration  - duration in seconds (default 0.5)
 * @param waveform  - oscillator waveform (default "triangle")
 */
export function playNote(
  frequency: number,
  duration: number = DEFAULT_DURATION,
  waveform: OscillatorType = DEFAULT_WAVEFORM,
): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = waveform;
  osc.frequency.setValueAtTime(frequency, now);

  // Envelope: quick attack, sustain, smooth release
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.02);       // attack
  gain.gain.setValueAtTime(0.3, now + duration * 0.7);      // sustain
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // release

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

/**
 * Play a note by name and octave.
 *
 * @param note     - note name (e.g. "C", "F#")
 * @param octave   - octave number (default 4)
 * @param duration - duration in seconds (default 0.5)
 */
export function playNoteByName(
  note: string,
  octave: number = DEFAULT_OCTAVE,
  duration: number = DEFAULT_DURATION,
): void {
  const freq = noteToFrequency(note, octave);
  playNote(freq, duration);
}

/**
 * Play two notes sequentially (an interval).
 * The second note starts immediately after the first finishes.
 *
 * @param note1    - first note name
 * @param note2    - second note name
 * @param duration - duration of each note in seconds (default 0.5)
 * @param octave   - octave for both notes (default 4)
 */
export function playInterval(
  note1: string,
  note2: string,
  duration: number = DEFAULT_DURATION,
  octave: number = DEFAULT_OCTAVE,
): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const freq1 = noteToFrequency(note1, octave);
  const freq2 = noteToFrequency(note2, octave);

  // First note
  scheduleNote(ctx, freq1, now, duration);
  // Second note starts after the first
  scheduleNote(ctx, freq2, now + duration, duration);
}

/**
 * Play multiple notes simultaneously (a chord) with an optional strum delay.
 *
 * @param notes      - array of note names
 * @param duration   - total duration in seconds (default 1.0)
 * @param strumDelay - delay in seconds between each note onset (default 0.03, giving a natural strum feel)
 * @param octave     - base octave (default 4). Notes are assigned ascending octaves when they wrap around.
 */
export function playChord(
  notes: string[],
  duration: number = 1.0,
  strumDelay: number = 0.03,
  octave: number = DEFAULT_OCTAVE,
): void {
  if (notes.length === 0) return;

  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Assign octaves: start at base octave, increment when a note index
  // is lower than or equal to the previous (indicating a wrap around C).
  let currentOctave = octave;
  const frequencies: number[] = [];
  let prevIndex = getNoteIndex(notes[0]);

  for (let i = 0; i < notes.length; i++) {
    const noteIndex = getNoteIndex(notes[i]);
    if (i > 0 && noteIndex <= prevIndex) {
      currentOctave++;
    }
    frequencies.push(noteToFrequency(notes[i], currentOctave));
    prevIndex = noteIndex;
  }

  // Schedule each note with strum offset
  frequencies.forEach((freq, i) => {
    const noteStart = now + i * strumDelay;
    // Each note's gain is reduced proportionally to chord size to avoid clipping
    scheduleNote(ctx, freq, noteStart, duration, 0.25 / Math.sqrt(notes.length));
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Schedule a single oscillator note at a precise time on the given AudioContext.
 */
function scheduleNote(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  peakGain: number = 0.3,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = DEFAULT_WAVEFORM;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.setValueAtTime(peakGain, startTime + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}
