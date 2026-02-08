'use client';

import type { NotationMode } from '../types';
import type { CustomChordEntry } from '../hooks/useCustomProgression';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DiatonicChordInfo {
  chordName: string;
  romanNumeral: string;
  nashvilleNumber: string;
}

interface CustomProgressionBuilderProps {
  /** The 7 diatonic chords for the selected key, with notation labels. */
  diatonicChords: DiatonicChordInfo[];
  /** The current custom progression entries. */
  progression: CustomChordEntry[];
  /** Current notation display mode. */
  notationMode: NotationMode;
  /** Whether this custom progression is currently playing. */
  isPlaying: boolean;
  /** Index of the currently-playing chord (null when not playing). */
  activeChordIndex: number | null;
  /** Add a chord by diatonic index. */
  onAddChord: (diatonicIndex: number) => void;
  /** Remove a chord by its unique ID. */
  onRemoveChord: (id: number) => void;
  /** Clear all chords. */
  onClear: () => void;
  /** Toggle playback of the custom progression. */
  onTogglePlayback: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Custom progression builder: clickable diatonic chord buttons and a
 * sequence bar showing the built progression with remove/play/clear controls.
 */
export default function CustomProgressionBuilder({
  diatonicChords,
  progression,
  notationMode,
  isPlaying,
  activeChordIndex,
  onAddChord,
  onRemoveChord,
  onClear,
  onTogglePlayback,
}: CustomProgressionBuilderProps) {
  const hasChords = progression.length > 0;

  return (
    <div className="space-y-3">
      {/* Diatonic chord buttons */}
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">
          Click to add
        </div>
        <div className="flex flex-wrap gap-1.5">
          {diatonicChords.map((chord, i) => (
            <button
              key={i}
              onClick={() => onAddChord(i)}
              className="flex flex-col items-center px-2.5 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <span className="text-sm font-medium text-white">{chord.chordName}</span>
              <span className="text-xs text-gray-400">
                {notationMode === 'roman' ? chord.romanNumeral : chord.nashvilleNumber}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Built progression sequence */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Sequence</span>
          {hasChords && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={onClear}
                className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={onTogglePlayback}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                  isPlaying
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
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
          )}
        </div>

        {hasChords ? (
          <div className="flex flex-wrap gap-1.5">
            {progression.map((entry, i) => {
              const chord = diatonicChords[entry.diatonicIndex];
              if (!chord) return null;
              const isActive = isPlaying && activeChordIndex === i;
              return (
                <div
                  key={entry.id}
                  className={`group relative flex flex-col items-center px-2 py-1 rounded transition-all ${
                    isActive
                      ? 'bg-blue-600 scale-105'
                      : 'bg-gray-700/50'
                  }`}
                >
                  <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white'}`}>
                    {chord.chordName}
                  </span>
                  <span className={`text-xs ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>
                    {notationMode === 'roman' ? chord.romanNumeral : chord.nashvilleNumber}
                  </span>
                  {/* Remove button */}
                  {!isPlaying && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveChord(entry.id);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove"
                    >
                      x
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-600 italic">
            Click chords above to build a progression
          </div>
        )}
      </div>
    </div>
  );
}
