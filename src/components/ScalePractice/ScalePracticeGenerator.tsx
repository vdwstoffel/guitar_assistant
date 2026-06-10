'use client';

import { useEffect, useMemo, useState } from 'react';
import AlphaTexStatic from '@/components/AlphaTexStatic';
import { getScaleNotes } from '@/lib/musicTheory';
import {
  generateExercise,
  type GeneratedExercise,
} from '@/lib/exerciseGenerator';
import ExerciseControls, { type ControlsState } from './ExerciseControls';
import ScalePracticeFretboard from './ScalePracticeFretboard';

const DEFAULT_STATE: ControlsState = {
  root: 'A',
  scaleType: 'Minor Pentatonic',
  exerciseType: 'ascending',
  position: 1,
  tempo: 80,
  duration: '8',
  bars: 4,
};

export default function ScalePracticeGenerator() {
  const [state, setState] = useState<ControlsState>(DEFAULT_STATE);
  const [exercise, setExercise] = useState<GeneratedExercise | null>(null);

  const generate = () => setExercise(generateExercise(state));

  // Auto-generate on first mount so the page isn't empty.
  useEffect(() => {
    setExercise(generateExercise(DEFAULT_STATE));
  }, []);

  const scaleNotes = useMemo(
    () => new Set(getScaleNotes(state.root, state.scaleType)),
    [state.root, state.scaleType],
  );

  return (
    <div
      className="flex-1 flex flex-col items-center p-6 overflow-auto"
      style={{ background: 'linear-gradient(to bottom, hsl(23, 64%, 5%), hsl(23, 64%, 18%))' }}
    >
      <div className="w-full max-w-6xl space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-amber-100">Scale Practice Generator</h1>
          <p className="text-amber-200/70 mt-1 text-sm">
            Pick a scale and exercise type — fresh tab is generated every click.
          </p>
        </header>

        <ExerciseControls state={state} onChange={setState} onGenerate={generate} />

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
              <AlphaTexStatic alphatex={exercise.alphatex} />
            </div>

            <div>
              <h2 className="text-amber-200 text-sm uppercase tracking-wide mb-2">
                Scale Notes on Fretboard
              </h2>
              <ScalePracticeFretboard
                root={state.root}
                scaleType={state.scaleType}
                highlightRange={exercise.positionRange}
                scaleNotes={scaleNotes}
              />
              <div className="flex items-center gap-4 mt-2 text-xs text-amber-200/70">
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}
                  />
                  Root ({state.root})
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #4a5568, #2d3748)' }}
                  />
                  Other scale tones
                </span>
                {exercise.positionRange && (
                  <span className="text-amber-300/80">
                    Position: frets {exercise.positionRange[0]}–{exercise.positionRange[1]}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
