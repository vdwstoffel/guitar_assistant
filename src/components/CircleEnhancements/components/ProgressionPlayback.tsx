'use client';

import type { NotationMode } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProgressionChordDisplay {
  chordName: string;
  romanNumeral: string;
  nashvilleNumber: string;
}

interface ProgressionPlaybackProps {
  /** Label for this progression (e.g. "Pop", "Jazz", "Custom"). */
  label: string;
  /** Roman numeral formula (e.g. "I - IV - V - I"). */
  formula: string;
  /** Resolved chord data for each position in the progression. */
  chords: ProgressionChordDisplay[];
  /** Whether playback is currently active for THIS progression. */
  isPlaying: boolean;
  /** Index of the currently-playing chord (null when not playing). */
  activeChordIndex: number | null;
  /** Current notation display mode. */
  notationMode: NotationMode;
  /** Callback to toggle playback. */
  onTogglePlayback: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays a single chord progression with a play/stop button and highlights
 * the active chord during playback.
 *
 * Purely presentational -- all playback state is managed by the parent via hooks.
 */
export default function ProgressionPlayback({
  label,
  formula,
  chords,
  isPlaying,
  activeChordIndex,
  notationMode,
  onTogglePlayback,
}: ProgressionPlaybackProps) {
  return (
    <div className="border-b border-gray-700 last:border-0 pb-2.5 last:pb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-400 text-sm font-medium">{label}</span>
        <span className="text-gray-600 text-xs">{formula}</span>
        <button
          onClick={onTogglePlayback}
          className={`ml-auto w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
            isPlaying
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-gray-600 hover:bg-gray-500'
          }`}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {chords.map((chord, i) => {
          const isActive = isPlaying && activeChordIndex === i;
          return (
            <div
              key={i}
              className={`flex flex-col items-center px-2 py-1 rounded transition-all ${
                isActive
                  ? 'bg-blue-600 scale-105'
                  : 'bg-gray-700/50'
              }`}
            >
              <span className={`text-base font-medium ${isActive ? 'text-white' : 'text-white'}`}>
                {chord.chordName}
              </span>
              <span className={`text-xs ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>
                {notationMode === 'roman' ? chord.romanNumeral : chord.nashvilleNumber}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
