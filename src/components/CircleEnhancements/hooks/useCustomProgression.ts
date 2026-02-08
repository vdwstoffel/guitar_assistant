import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A chord entry in the custom progression, identified by its diatonic index. */
export interface CustomChordEntry {
  /** Unique ID for React key and removal. */
  id: number;
  /** Index into the diatonic chords array (0-6). */
  diatonicIndex: number;
}

export interface CustomProgressionState {
  /** The sequence of chords the user has built. */
  chords: CustomChordEntry[];
}

export interface CustomProgressionActions {
  /** Add a chord (by diatonic index) to the end of the progression. */
  addChord: (diatonicIndex: number) => void;
  /** Remove a chord by its unique ID. */
  removeChord: (id: number) => void;
  /** Clear all chords from the custom progression. */
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let nextId = 1;

/**
 * Manages the custom chord progression builder state.
 *
 * Each chord is stored with a unique ID so that duplicates (e.g. I - IV - V - I)
 * can be individually removed. The diatonic index maps to the key's chord array.
 */
export function useCustomProgression(): CustomProgressionState & CustomProgressionActions {
  const [chords, setChords] = useState<CustomChordEntry[]>([]);

  const addChord = useCallback((diatonicIndex: number) => {
    setChords(prev => [...prev, { id: nextId++, diatonicIndex }]);
  }, []);

  const removeChord = useCallback((id: number) => {
    setChords(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setChords([]);
  }, []);

  return {
    chords,
    addChord,
    removeChord,
    clearAll,
  };
}
