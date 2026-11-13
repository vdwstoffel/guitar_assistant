import { getNoteIndex, getNoteName } from "../musicTheory";
import { INTERVAL_LABELS, chordName, intervalFeel, scalePitchClasses, type ProgressionChord } from "./theory";

/** What the hint strip says about one note at the tab editor's caret. */
export interface CaretHint {
  /** "C — 5 over F", "C — b3 over the key", or the no-note message. */
  title: string;
  /** How that interval sounds, in words ("Open, powerful, stable"). */
  detail: string;
  /** Whether the note is in the riff's scale; null with no note, or a scale of no notes. */
  inScale: boolean | null;
}

export const NO_NOTE_HINT: CaretHint = {
  title: "No note at the caret",
  detail: "Put the caret on a note to see how it sounds over the chord",
  inScale: null,
};

const pcOf = (n: number) => ((n % 12) + 12) % 12;

/**
 * How a note sounds over the chord of its bar: its interval above the chord's
 * root, and that interval's feel. With no chord (a riff made without a
 * progression) the interval is measured from the key root instead.
 */
export function caretHint(input: {
  midi: number | null;
  chord: ProgressionChord | null;
  keyRoot: string;
  scale: string;
}): CaretHint {
  const { midi, chord, keyRoot, scale } = input;
  if (midi === null) return NO_NOTE_HINT;
  const pc = pcOf(midi);
  const scalePcs = scalePitchClasses(keyRoot, scale);
  const inScale = scalePcs.length > 0 ? scalePcs.includes(pc) : null;
  const fromPc = getNoteIndex(chord ? chord.root : keyRoot);
  const note = getNoteName(pc);
  if (fromPc === -1) return { title: note, detail: "", inScale };
  const semitones = pcOf(pc - fromPc);
  return {
    title: `${note} — ${INTERVAL_LABELS[semitones]} over ${chord ? chordName(chord) : "the key"}`,
    detail: intervalFeel(semitones),
    inScale,
  };
}

/** One hint per note at the caret, lowest first; the no-note hint on a rest or an empty beat. */
export function caretHints(input: {
  midis: number[];
  chord: ProgressionChord | null;
  keyRoot: string;
  scale: string;
}): CaretHint[] {
  const { midis, ...rest } = input;
  if (midis.length === 0) return [NO_NOTE_HINT];
  return [...midis].sort((a, b) => a - b).map((midi) => caretHint({ midi, ...rest }));
}
