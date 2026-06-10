const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export type TuningString = {
  name: string;
  octave: number;
  freq: number;
};

export type TuningPreset = {
  id: string;
  label: string;
  strings: TuningString[];
};

function noteFreq(name: string, octave: number): number {
  const semitone = NOTE_NAMES.indexOf(name);
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function s(name: string, octave: number): TuningString {
  return { name, octave, freq: noteFreq(name, octave) };
}

export const TUNING_PRESETS: TuningPreset[] = [
  {
    id: 'standard',
    label: 'Standard (E A D G B E)',
    strings: [s('E', 2), s('A', 2), s('D', 3), s('G', 3), s('B', 3), s('E', 4)],
  },
  {
    id: 'drop-d',
    label: 'Drop D (D A D G B E)',
    strings: [s('D', 2), s('A', 2), s('D', 3), s('G', 3), s('B', 3), s('E', 4)],
  },
  {
    id: 'dadgad',
    label: 'DADGAD',
    strings: [s('D', 2), s('A', 2), s('D', 3), s('G', 3), s('A', 3), s('D', 4)],
  },
  {
    id: 'open-g',
    label: 'Open G (D G D G B D)',
    strings: [s('D', 2), s('G', 2), s('D', 3), s('G', 3), s('B', 3), s('D', 4)],
  },
  {
    id: 'open-d',
    label: 'Open D (D A D F# A D)',
    strings: [s('D', 2), s('A', 2), s('D', 3), s('F#', 3), s('A', 3), s('D', 4)],
  },
  {
    id: 'half-step',
    label: 'Half-step down (Eb)',
    strings: [s('D#', 2), s('G#', 2), s('C#', 3), s('F#', 3), s('A#', 3), s('D#', 4)],
  },
];

export function freqToNote(freq: number): { name: string; octave: number; cents: number; targetFreq: number } {
  const midiFloat = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const targetFreq = 440 * Math.pow(2, (midi - 69) / 12);
  return { name, octave, cents, targetFreq };
}

export function nearestString(freq: number, strings: TuningString[]): { index: number; cents: number } {
  let bestIdx = 0;
  let bestAbsCents = Infinity;
  let bestCents = 0;
  for (let i = 0; i < strings.length; i++) {
    const cents = 1200 * Math.log2(freq / strings[i].freq);
    if (Math.abs(cents) < bestAbsCents) {
      bestAbsCents = Math.abs(cents);
      bestIdx = i;
      bestCents = cents;
    }
  }
  return { index: bestIdx, cents: Math.round(bestCents) };
}
