'use client';

import { STANDARD_TUNING } from '@/lib/musicTheory';
import type { TrainerPhase, NoteTrainerConfig, MicStatus } from './types';

interface NoteTrainerControlsProps {
  config: NoteTrainerConfig;
  phase: TrainerPhase;
  currentNote: string | null;
  currentBeat: number;
  isRunning: boolean;
  micStatus: MicStatus;
  micError: string | null;
  detectedNote: string | null;
  matchHit: boolean;
  missedNote: string | null;
  correct: number;
  total: number;
  streak: number;
  completed: boolean;
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
  micStatus,
  micError,
  detectedNote,
  matchHit,
  missedNote,
  correct,
  total,
  streak,
  completed,
  onStart,
  onStop,
  onUpdateConfig,
}: NoteTrainerControlsProps) {
  const totalBeats = 4;

  const showScore = config.listenEnabled && (isRunning || completed || total > 0);

  return (
    <div className="space-y-6">
      {/* Completion banner */}
      {completed && (
        <div className="text-center py-4 rounded-lg bg-green-900/30 border border-green-600/50">
          <div className="text-3xl font-bold text-green-400 mb-1">Complete!</div>
          <p className="text-green-200/80 text-sm">
            {config.targetStreak} in a row · {correct}/{total} overall
          </p>
        </div>
      )}

      {/* Score chip */}
      {showScore && !completed && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="px-3 py-1 rounded bg-amber-900/40 border border-amber-700/40 text-amber-100">
            <span className="text-amber-200/60">Score</span>{' '}
            <span className="font-semibold">{correct}</span>
            <span className="text-amber-200/40"> / {total}</span>
          </span>
          <span className="px-3 py-1 rounded bg-amber-900/40 border border-amber-700/40 text-amber-100">
            <span className="text-amber-200/60">Streak</span>{' '}
            <span className="font-semibold text-green-400">{streak}</span>
            {config.targetStreak > 0 && (
              <span className="text-amber-200/40"> / {config.targetStreak}</span>
            )}
          </span>
        </div>
      )}

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
            {phase === 'counting'
              ? 'Find this note!'
              : phase === 'revealing'
              ? config.listenEnabled
                ? matchHit
                  ? 'Correct!'
                  : missedNote
                  ? 'Wrong!'
                  : 'Play it now…'
                : 'Here it is!'
              : ''}
          </p>

          {/* Live pitch feedback when listening */}
          {config.listenEnabled && phase === 'revealing' && (
            <div className="flex items-center justify-center gap-2 text-sm">
              {matchHit ? (
                <span className="text-green-400 text-2xl">✓</span>
              ) : missedNote ? (
                <>
                  <span className="text-red-400 text-2xl">✗</span>
                  <span className="text-red-300/80">
                    You played <span className="font-semibold">{missedNote}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-amber-200/50">Heard:</span>
                  <span className="text-amber-100 font-semibold w-8 text-left">
                    {detectedNote ?? '—'}
                  </span>
                </>
              )}
            </div>
          )}

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

        {/* Volume */}
        <div className="flex items-center gap-2">
          <label className="text-amber-200/70 text-sm">Vol</label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.volume}
            onChange={(e) => onUpdateConfig({ volume: parseInt(e.target.value) })}
            className="w-20 h-1 bg-amber-900/50 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <span className="text-amber-200/50 text-xs w-7 text-right">{config.volume}</span>
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

        {/* Voice toggle */}
        <div className="flex items-center gap-2">
          <label className="text-amber-200/70 text-sm">Voice</label>
          <button
            onClick={() => onUpdateConfig({ voiceEnabled: !config.voiceEnabled })}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              config.voiceEnabled
                ? 'bg-amber-600 text-white'
                : 'bg-amber-900/50 text-amber-200 hover:bg-amber-800/50'
            }`}
            title="Speak the note name out loud at the start of each cycle"
          >
            {config.voiceEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {/* Listen (mic) toggle */}
        <div className="flex items-center gap-2">
          <label className="text-amber-200/70 text-sm">Listen</label>
          <button
            onClick={() => onUpdateConfig({ listenEnabled: !config.listenEnabled })}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              config.listenEnabled
                ? 'bg-amber-600 text-white'
                : 'bg-amber-900/50 text-amber-200 hover:bg-amber-800/50'
            }`}
            title="Use the microphone to detect when you play the correct note (any octave)"
          >
            {config.listenEnabled ? 'On' : 'Off'}
          </button>
          {config.listenEnabled && isRunning && (
            <span className="text-xs flex items-center gap-1">
              {micStatus === 'listening' && (
                <>
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-amber-200/50">mic on</span>
                </>
              )}
              {micStatus === 'requesting' && <span className="text-amber-200/50">requesting…</span>}
              {(micStatus === 'denied' || micStatus === 'error') && (
                <span className="text-red-400">{micError ?? 'mic error'}</span>
              )}
            </span>
          )}
        </div>

        {/* Target streak — end exercise after N correct in a row */}
        {config.listenEnabled && (
          <div className="flex items-center gap-2">
            <label
              className="text-amber-200/70 text-sm"
              title="End the exercise after this many correct in a row (0 = endless)"
            >
              Target
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={config.targetStreak}
              onChange={(e) => {
                const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                onUpdateConfig({ targetStreak: v });
              }}
              disabled={isRunning}
              className="w-16 px-2 py-1 rounded bg-amber-900/50 text-amber-100 text-center border border-amber-700/50 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
          </div>
        )}
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
