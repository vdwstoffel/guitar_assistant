/**
 * Convert FretNote sequences into AlphaTex notation strings.
 *
 * AlphaTex string convention: 1 = high E (1st string), 6 = low E (6th string).
 * Our internal FretNote.string: 0 = low E (6th), 5 = high E (1st).
 * Conversion: alphaTexString = 6 - fretNote.string
 */

import type { FretNote } from './scalePositions';

export type AlphaTexDuration = '8' | '16' | 'mixed';

export interface SerializerOptions {
  title: string;
  tempo: number;
  duration: AlphaTexDuration;
  /** alphaTab instrument code (25 = acoustic nylon, 29 = overdriven guitar). */
  instrument?: number;
}

/** Beats per bar in 4/4. */
const BEATS_PER_BAR = 4;

/** Beat value of an AlphaTex duration token. */
function beatValue(duration: '8' | '16'): number {
  return duration === '8' ? 0.5 : 0.25;
}

function escapeTitle(title: string): string {
  return title.replace(/"/g, '\\"');
}

/** Convert one note to its AlphaTex `fret.string` token. */
function noteToken(note: FretNote): string {
  const alphaString = 6 - note.string;
  return `${note.fret}.${alphaString}`;
}

/**
 * Emit notes grouped into bars. Inserts `|` whenever accumulated beat value
 * reaches BEATS_PER_BAR. Honors a per-note duration when in mixed mode.
 */
function emitBody(notes: FretNote[], duration: AlphaTexDuration): string {
  if (notes.length === 0) return '|';

  const parts: string[] = [];
  let currentDuration: '8' | '16' | null = null;
  let beatsInBar = 0;

  notes.forEach((note, idx) => {
    // In mixed mode, alternate :8 and :16 every 4 notes for rhythmic variety.
    const targetDuration: '8' | '16' =
      duration === 'mixed' ? (Math.floor(idx / 4) % 2 === 0 ? '8' : '16') : duration;

    if (targetDuration !== currentDuration) {
      parts.push(`:${targetDuration}`);
      currentDuration = targetDuration;
    }

    parts.push(noteToken(note));
    beatsInBar += beatValue(targetDuration);

    if (beatsInBar >= BEATS_PER_BAR - 1e-9) {
      parts.push('|');
      beatsInBar = 0;
    }
  });

  // Pad final bar with a rest of the current duration if it didn't close.
  if (beatsInBar > 0 && currentDuration) {
    const remaining = BEATS_PER_BAR - beatsInBar;
    if (remaining >= 0.5) {
      // Use whole-beat rests where possible.
      const wholeBeats = Math.floor(remaining);
      for (let i = 0; i < wholeBeats; i++) parts.push(':4 r');
    }
    parts.push('|');
  }

  return parts.join(' ');
}

export function fretNotesToAlphaTex(
  notes: FretNote[],
  options: SerializerOptions,
): string {
  const { title, tempo, duration, instrument = 25 } = options;
  const header = [
    `\\title "${escapeTitle(title)}"`,
    `\\tempo ${tempo}`,
    `\\instrument ${instrument}`,
    '.',
  ].join('\n');

  return `${header}\n${emitBody(notes, duration)}`;
}
