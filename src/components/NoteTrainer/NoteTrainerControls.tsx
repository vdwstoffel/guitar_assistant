'use client';

import { STANDARD_TUNING } from '@/lib/musicTheory';
import type { TrainerPhase, NoteTrainerConfig } from './types';

interface NoteTrainerControlsProps {
  config: NoteTrainerConfig;
  phase: TrainerPhase;
  currentNote: string | null;
  currentBeat: number;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  onUpdateConfig: (partial: Partial<NoteTrainerConfig>) => void;
}

export default function NoteTrainerControls({
  config,
  phase,
  currentNote,
  currentBeat,
  isRunning,
  onStart,
  onStop,
  onUpdateConfig,
}: NoteTrainerControlsProps) {
  const totalBeats = 4;

  return (
    <div className="space-y-6">
      {/* Note display + beat indicator */}
      {isRunning && (
        <div className="text-center space-y-4">
          {/* Current note */}
          <div
            className="text-8xl font-bold transition-all duration-200"
            style={{
              color: phase === 'revealing' ? '#22c55e' : '#fde68a',
              textShadow:
                phase === 'revealing'
                  ? '0 0 30px rgba(34, 197, 94, 0.5)'
                  : '0 0 20px rgba(253, 230, 138, 0.3)',
            }}
          >
            {currentNote ?? '...'}
          </div>

          <p className="text-amber-200/60 text-sm">
            {phase === 'counting' ? 'Find this note!' : phase === 'revealing' ? 'Here it is!' : ''}
          </p>

          {/* Beat indicator dots */}
          <div className="flex justify-center gap-3">
            {Array.from({ length: totalBeats }, (_, i) => {
              const beatNum = i + 1;
              const isActive = phase === 'counting' && currentBeat >= beatNum;
              const isFirst = i === 0;
              return (
                <div
                  key={i}
                  className="rounded-full transition-all duration-100"
                  style={{
                    width: '16px',
                    height: '16px',
                    background: isActive
                      ? isFirst
                        ? '#dc2626'
                        : '#3b82f6'
                      : '#4b5563',
                    transform: isActive ? 'scale(1.3)' : 'scale(1)',
                    boxShadow: isActive
                      ? `0 0 8px ${isFirst ? 'rgba(220, 38, 38, 0.6)' : 'rgba(59, 130, 246, 0.6)'}`
                      : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-center gap-6">
        {/* Start/Stop */}
        <button
          onClick={isRunning ? onStop : onStart}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: isRunning
              ? 'linear-gradient(135deg, #dc2626, #991b1b)'
              : 'linear-gradient(135deg, #16a34a, #15803d)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
        >
          {isRunning ? (
            // Stop icon
            <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
          ) : (
            // Play icon
            <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
              <polygon points="5,2 18,10 5,18" />
            </svg>
          )}
        </button>

        {/* BPM */}
        <div className="flex items-center gap-2">
          <label className="text-amber-200/70 text-sm">BPM</label>
          <button
            onClick={() => onUpdateConfig({ bpm: Math.max(40, config.bpm - 5) })}
            className="w-7 h-7 rounded bg-amber-900/50 text-amber-200 hover:bg-amber-800/50 flex items-center justify-center text-lg"
            disabled={isRunning}
          >
            -
          </button>
          <input
            type="number"
            min={40}
            max={200}
            value={config.bpm}
            onChange={(e) => {
              const v = Math.min(200, Math.max(40, Number(e.target.value) || 40));
              onUpdateConfig({ bpm: v });
            }}
            disabled={isRunning}
            className="w-16 px-2 py-1 rounded bg-amber-900/50 text-amber-100 text-center border border-amber-700/50 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          />
          <button
            onClick={() => onUpdateConfig({ bpm: Math.min(200, config.bpm + 5) })}
            className="w-7 h-7 rounded bg-amber-900/50 text-amber-200 hover:bg-amber-800/50 flex items-center justify-center text-lg"
            disabled={isRunning}
          >
            +
          </button>
        </div>

        {/* Note pool toggle */}
        <div className="flex items-center gap-2">
          <label className="text-amber-200/70 text-sm">Notes</label>
          <button
            onClick={() =>
              onUpdateConfig({
                notePool: config.notePool === 'natural' ? 'all' : 'natural',
              })
            }
            disabled={isRunning}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              config.notePool === 'all'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-900/50 text-amber-200 hover:bg-amber-800/50'
            } disabled:opacity-50`}
          >
            {config.notePool === 'natural' ? 'Natural' : 'All 12'}
          </button>
        </div>
      </div>

      {/* String selection */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-amber-200/70 text-sm">Strings:</span>
        {STANDARD_TUNING.map((name, i) => {
          const enabled = config.enabledStrings[i];
          return (
            <button
              key={i}
              onClick={() => {
                const next = [...config.enabledStrings];
                next[i] = !next[i];
                // Ensure at least one string stays enabled
                if (next.some(Boolean)) {
                  onUpdateConfig({ enabledStrings: next });
                }
              }}
              disabled={isRunning}
              className={`w-9 h-9 rounded-full text-xs font-bold transition-colors ${
                enabled
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-900/30 text-amber-200/40 border border-amber-700/30'
              } disabled:opacity-50`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
