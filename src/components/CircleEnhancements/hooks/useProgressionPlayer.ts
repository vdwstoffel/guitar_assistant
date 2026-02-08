import { useState, useCallback, useRef, useEffect } from 'react';
import { getChordNotes } from '@/lib/musicTheory';
import { playChord } from '@/lib/audioGenerator';
import { getSharpRoot, getChordQuality } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressionPlayerState {
  /** Whether playback is currently active. */
  isPlaying: boolean;
  /** Current BPM (beats per minute). */
  bpm: number;
  /** Index of the currently-playing chord in the progression (null when stopped). */
  activeChordIndex: number | null;
}

export interface ProgressionPlayerActions {
  /** Start or stop playback of the given chord names. */
  togglePlayback: (chordNames: string[]) => void;
  /** Stop playback immediately. */
  stopPlayback: () => void;
  /** Update the BPM value. */
  setBpm: (bpm: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_BPM = 60;
const MAX_BPM = 180;
const DEFAULT_BPM = 100;
/** Duration of each chord in seconds, relative to beat duration. Each chord = 2 beats. */
const BEATS_PER_CHORD = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Play a single chord by name using the audio generator.
 * Converts flat-based names to sharp-based for musicTheory lookup.
 */
function playChordByName(chordName: string, bpm: number): void {
  const root = getSharpRoot(chordName);
  const quality = getChordQuality(chordName);
  const notes = getChordNotes(root, quality);
  if (notes.length > 0) {
    // Duration: 2 beats at current tempo, with guitar-like strum delay
    const duration = (BEATS_PER_CHORD * 60) / bpm;
    playChord(notes, duration, 0.03, 3);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages chord progression playback using setTimeout-based scheduling.
 *
 * Cycles through the progression chords at the configured BPM, looping
 * back to the start. The active chord index updates in sync with audio
 * so the UI can highlight the current chord.
 *
 * All mutable scheduling state lives in refs to avoid stale closures.
 * The scheduler function itself is a plain function that reads from refs
 * and reschedules itself via setTimeout.
 */
export function useProgressionPlayer(): ProgressionPlayerState & ProgressionPlayerActions {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(DEFAULT_BPM);
  const [activeChordIndex, setActiveChordIndex] = useState<number | null>(null);

  // Refs for scheduler access (avoids stale closures)
  const bpmRef = useRef(DEFAULT_BPM);
  const isPlayingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chordNamesRef = useRef<string[]>([]);
  const chordIndexRef = useRef(0);
  const setActiveChordIndexRef = useRef(setActiveChordIndex);

  // Keep refs in sync via effects (React 19 prohibits ref writes during render)
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { setActiveChordIndexRef.current = setActiveChordIndex; }, []);

  const setBpm = useCallback((value: number) => {
    const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, value));
    setBpmState(clamped);
  }, []);

  /**
   * The self-scheduling function. Reads all state from refs.
   * Defined outside of useCallback to avoid self-reference issues.
   */
  const tick = useCallback(function tickFn() {
    if (!isPlayingRef.current) return;

    const chords = chordNamesRef.current;
    if (chords.length === 0) return;

    const index = chordIndexRef.current;
    setActiveChordIndexRef.current(index);
    playChordByName(chords[index], bpmRef.current);

    // Advance to next chord (loop)
    chordIndexRef.current = (index + 1) % chords.length;

    // Schedule next tick after beat duration
    const msPerChord = (BEATS_PER_CHORD * 60 * 1000) / bpmRef.current;
    timerRef.current = setTimeout(tickFn, msPerChord);
  }, []);

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setActiveChordIndex(null);
    chordIndexRef.current = 0;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const togglePlayback = useCallback((chordNames: string[]) => {
    if (isPlayingRef.current) {
      stopPlayback();
      return;
    }

    if (chordNames.length === 0) return;

    chordNamesRef.current = chordNames;
    chordIndexRef.current = 0;
    isPlayingRef.current = true;
    setIsPlaying(true);
    tick();
  }, [stopPlayback, tick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    bpm,
    activeChordIndex,
    togglePlayback,
    stopPlayback,
    setBpm,
  };
}
