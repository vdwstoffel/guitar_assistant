'use client';

import { useEffect, useState } from 'react';
import type { ScaleType } from '@/lib/musicTheory';
import AlphaTexStatic from '@/components/AlphaTexStatic';
import {
  generateExercise,
  EXERCISE_TYPES,
  type ExerciseType,
  type GeneratedExercise,
} from '@/lib/exerciseGenerator';
import type { AlphaTexDuration } from '@/lib/alphatexSerializer';

// ---------------------------------------------------------------------------
// Props & local control state
// ---------------------------------------------------------------------------

interface PracticeExerciseTabProps {
  /** Root note, taken from the fretboard's Key selector at the top of the page. */
  root: string;
  /** Scale, taken from the fretboard's Scale selector at the top of the page. */
  scaleType: ScaleType;
}

interface ExerciseSettings {
  exerciseType: ExerciseType;
  position: number | null; // null = full neck
  duration: AlphaTexDuration;
  bars: number;
}

const DEFAULT_SETTINGS: ExerciseSettings = {
  exerciseType: 'ascending',
  position: 1,
  duration: '8',
  bars: 4,
};

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
  'bg-amber-900/50 border border-amber-700/50 rounded px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-500';
const LABEL_CLASS = 'text-amber-200/70 text-xs uppercase tracking-wide mb-1';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Practice-exercise generator shown as a tab below the fretboard. Uses the
 * fretboard's selected Key/Scale (via props — no duplicate selectors here) and
 * renders the result full-width through AlphaTexStatic.
 */
export default function PracticeExerciseTab({ root, scaleType }: PracticeExerciseTabProps) {
  const [settings, setSettings] = useState<ExerciseSettings>(DEFAULT_SETTINGS);
  const [exercise, setExercise] = useState<GeneratedExercise | null>(null);

  const generate = () =>
    setExercise(generateExercise({ root, scaleType, ...settings }));

  // Auto-generate whenever the scale/key changes so the tab isn't stale/empty.
  // Clears out when no scale is selected.
  useEffect(() => {
    if (scaleType === 'None') {
      setExercise(null);
      return;
    }
    setExercise(generateExercise({ root, scaleType, ...settings }));
    // Regenerate only on root/scale change; control edits apply on Generate click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, scaleType]);

  if (scaleType === 'None') {
    return (
      <p className="text-amber-200/60 text-sm py-6 text-center">
        Select a scale at the top of the page to generate a practice exercise.
      </p>
    );
  }

  const update = <K extends keyof ExerciseSettings>(key: K, value: ExerciseSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      {/* All controls on one row (Key/Scale come from the top of the page) */}
      <div className="bg-amber-950/30 rounded-lg p-4 border border-amber-800/30">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
          <div className="flex flex-col">
            <label className={LABEL_CLASS}>Exercise</label>
            <select
              className={SELECT_CLASS}
              value={settings.exerciseType}
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
              value={settings.position === null ? 'null' : String(settings.position)}
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

          <div className="flex flex-col">
            <label className={LABEL_CLASS}>Note Duration</label>
            <select
              className={SELECT_CLASS}
              value={settings.duration}
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
              value={settings.bars}
              onChange={(e) => update('bars', Number(e.target.value))}
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          </div>

          <button
            onClick={generate}
            className="bg-amber-600 hover:bg-amber-500 text-white font-medium rounded px-4 py-2 transition-colors"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Generated tab */}
      {exercise && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-amber-200 text-sm">{exercise.description}</p>
            <button
              onClick={generate}
              className="text-xs px-3 py-1 rounded bg-amber-900/50 hover:bg-amber-800/50 text-amber-200 transition-colors"
            >
              ↻ Regenerate
            </button>
          </div>

          <div className="bg-white/95 rounded-lg p-2">
            <AlphaTexStatic alphatex={exercise.alphatex} hideTempo />
          </div>
        </>
      )}
    </div>
  );
}
