import { useState, useMemo, useCallback } from 'react';
import {
  findMatchingKeys,
  getSuggestedChords,
  getStarterChords,
} from '@/lib/chordSuggestions';
import type { MatchingKey, ChordSuggestions } from '@/lib/chordSuggestions';
import type { ProgressionChordEntry } from '../types';

export interface ProgressionExplorerState {
  progression: ProgressionChordEntry[];
  matchingKeys: MatchingKey[];
  suggestions: ChordSuggestions;
  starterChords: ReturnType<typeof getStarterChords>;
}

export interface ProgressionExplorerActions {
  addChord: (chordName: string) => void;
  removeLastChord: () => void;
  removeChordAt: (index: number) => void;
  clearProgression: () => void;
}

export function useProgressionExplorer(): ProgressionExplorerState & ProgressionExplorerActions {
  const [progression, setProgression] = useState<ProgressionChordEntry[]>([]);

  const chordNames = useMemo(() => progression.map(c => c.name), [progression]);

  const matchingKeys = useMemo(
    () => findMatchingKeys(chordNames),
    [chordNames],
  );

  const suggestions = useMemo(
    () => getSuggestedChords(chordNames, matchingKeys),
    [chordNames, matchingKeys],
  );

  const starterChords = useMemo(() => getStarterChords(), []);

  const addChord = useCallback((chordName: string) => {
    setProgression(prev => [...prev, { name: chordName }]);
  }, []);

  const removeLastChord = useCallback(() => {
    setProgression(prev => prev.slice(0, -1));
  }, []);

  const removeChordAt = useCallback((index: number) => {
    setProgression(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearProgression = useCallback(() => {
    setProgression([]);
  }, []);

  return {
    progression,
    matchingKeys,
    suggestions,
    starterChords,
    addChord,
    removeLastChord,
    removeChordAt,
    clearProgression,
  };
}
