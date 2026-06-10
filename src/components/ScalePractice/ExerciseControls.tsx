'use client';

import { NOTES, SCALE_FORMULAS } from '@/lib/musicTheory';
import { EXERCISE_TYPES, type ExerciseType } from '@/lib/exerciseGenerator';
import type { AlphaTexDuration } from '@/lib/alphatexSerializer';

export interface ControlsState {
  root: string;
  scaleType: string;
  exerciseType: ExerciseType;
  position: number | null; // null = full neck
  tempo: number;
  duration: AlphaTexDuration;
  bars: number;
}

interface Props {
  state: ControlsState;
  onChange: (next: ControlsState) => void;
  onGenerate: () => void;
}

const PLAYABLE_SCALES = Object.keys(SCALE_FORMULAS).filter((k) => k !== 'None');
const POSITION_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Full Neck' },
  { value: 1, label: 'Position 1 (frets 0–4)' },
  { value: 2, label: 'Position 2 (frets 3–7)' },
  { value: 3, label: 'Position 3 (frets 5–9)' },
  { value: 4, label: 'Position 4 (frets 7–11)' },
  { value: 5, label: 'Position 5 (frets 9–13)' },
  { value: 6, label: 'Position 6 (frets 12–15)' },
];

const SELECT_CLASS =
  'bg-gray-800 border border-gray-700 rounded px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-500';
const LABEL_CLASS = 'text-amber-200/70 text-xs uppercase tracking-wide mb-1';

export default function ExerciseControls({ state, onChange, onGenerate }: Props) {
  const update = <K extends keyof ControlsState>(key: K, value: ControlsState[K]) =>
    onChange({ ...state, [key]: value });

  return (
    <div className="bg-gray-900/60 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex flex-col">
          <label className={LABEL_CLASS}>Key</label>
          <select
            className={SELECT_CLASS}
            value={state.root}
            onChange={(e) => update('root', e.target.value)}
          >
            {NOTES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className={LABEL_CLASS}>Scale</label>
          <select
            className={SELECT_CLASS}
            value={state.scaleType}
            onChange={(e) => update('scaleType', e.target.value)}
          >
            {PLAYABLE_SCALES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className={LABEL_CLASS}>Exercise</label>
          <select
            className={SELECT_CLASS}
            value={state.exerciseType}
            onChange={(e) => update('exerciseType', e.target.value as ExerciseType)}
          >
            {EXERCISE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className={LABEL_CLASS}>Position</label>
          <select
            className={SELECT_CLASS}
            value={state.position === null ? 'null' : String(state.position)}
            onChange={(e) =>
              update('position', e.target.value === 'null' ? null : Number(e.target.value))
            }
          >
            {POSITION_OPTIONS.map((p) => (
              <option key={String(p.value)} value={p.value === null ? 'null' : String(p.value)}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div className="flex flex-col">
          <label className={LABEL_CLASS}>Tempo (BPM)</label>
          <input
            type="number"
            min={40}
            max={240}
            step={5}
            className={SELECT_CLASS}
            value={state.tempo}
            onChange={(e) => update('tempo', Number(e.target.value) || 80)}
          />
        </div>

        <div className="flex flex-col">
          <label className={LABEL_CLASS}>Note Duration</label>
          <select
            className={SELECT_CLASS}
            value={state.duration}
            onChange={(e) => update('duration', e.target.value as AlphaTexDuration)}
          >
            <option value="8">Eighth notes</option>
            <option value="16">Sixteenth notes</option>
            <option value="mixed">Mixed (8th + 16th)</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className={LABEL_CLASS}>Bars</label>
          <select
            className={SELECT_CLASS}
            value={state.bars}
            onChange={(e) => update('bars', Number(e.target.value))}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </div>

        <button
          onClick={onGenerate}
          className="bg-amber-600 hover:bg-amber-500 text-white font-medium rounded px-4 py-2 transition-colors"
        >
          Generate
        </button>
      </div>
    </div>
  );
}
