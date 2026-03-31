'use client';

import { useCallback } from 'react';
import { useProgressionExplorer } from './hooks/useProgressionExplorer';
import { useProgressionPlayer } from '../CircleEnhancements';
import ProgressionTimeline from './components/ProgressionTimeline';
import PlaybackControls from './components/PlaybackControls';
import KeyIndicator from './components/KeyIndicator';
import SuggestionGrid from './components/SuggestionGrid';
import ChordStarter from './components/ChordStarter';

export default function ProgressionExplorer() {
  const {
    progression,
    matchingKeys,
    suggestions,
    starterChords,
    addChord,
    removeLastChord,
    removeChordAt,
    clearProgression,
  } = useProgressionExplorer();

  const player = useProgressionPlayer();

  const chordNames = progression.map(c => c.name);

  const handleTogglePlayback = useCallback(() => {
    if (chordNames.length === 0) return;
    player.togglePlayback(chordNames);
  }, [chordNames, player]);

  const handleClear = useCallback(() => {
    player.stopPlayback();
    clearProgression();
  }, [player, clearProgression]);

  const handleRemoveChordAt = useCallback((index: number) => {
    player.stopPlayback();
    removeChordAt(index);
  }, [player, removeChordAt]);

  const hasProgression = progression.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-gray-900">
      <div className="w-full max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">
            Progression Explorer
          </h1>
          <p className="text-gray-400 text-sm max-w-2xl mx-auto">
            Build chord progressions step by step. Pick a chord, see what works next,
            and explore harmonic possibilities.
          </p>
        </div>

        {/* Timeline + Playback bar */}
        {hasProgression && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <ProgressionTimeline
                progression={progression}
                activeChordIndex={player.isPlaying ? player.activeChordIndex : null}
                onRemoveChordAt={handleRemoveChordAt}
                onClear={handleClear}
              />
              <PlaybackControls
                isPlaying={player.isPlaying}
                bpm={player.bpm}
                disabled={progression.length === 0}
                onToggle={handleTogglePlayback}
                onBpmChange={player.setBpm}
              />
            </div>
          </div>
        )}

        {/* Key indicator */}
        {hasProgression && (
          <KeyIndicator matchingKeys={matchingKeys} />
        )}

        {/* Main content: Starter grid OR Suggestion grid */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-6">
          {hasProgression ? (
            <SuggestionGrid
              suggestions={suggestions}
              onSelect={addChord}
            />
          ) : (
            <ChordStarter
              starters={starterChords}
              onSelect={addChord}
            />
          )}
        </div>

        {/* Undo hint */}
        {hasProgression && (
          <div className="text-center">
            <button
              onClick={() => { player.stopPlayback(); removeLastChord(); }}
              className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
            >
              Undo last chord
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
