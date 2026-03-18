import { useState, useRef, useCallback } from 'react';
import { NOTES } from '@/lib/musicTheory';
import { playCountIn } from '@/lib/clickGenerator';
import { playNoteByName } from '@/lib/audioGenerator';
import {
  TrainerPhase,
  NoteTrainerConfig,
  DEFAULT_CONFIG,
  NATURAL_NOTES,
} from './types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRandomNote(pool: readonly string[], lastNote: string | null): string {
  const candidates = pool.length > 1 ? pool.filter((n) => n !== lastNote) : [...pool];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function useNoteTrainer() {
  const [phase, setPhase] = useState<TrainerPhase>('idle');
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<NoteTrainerConfig>(DEFAULT_CONFIG);

  // Refs for async loop management
  const cycleIdRef = useRef(0);
  const configRef = useRef(config);
  const lastNoteRef = useRef<string | null>(null);

  // Keep configRef in sync
  configRef.current = config;

  const getNotePool = useCallback((): readonly string[] => {
    return configRef.current.notePool === 'natural' ? NATURAL_NOTES : NOTES;
  }, []);

  const runCycle = useCallback(async (id: number) => {
    const cfg = configRef.current;
    const pool = cfg.notePool === 'natural' ? NATURAL_NOTES : NOTES;

    // 1. Pick random note
    const note = pickRandomNote(pool, lastNoteRef.current);
    lastNoteRef.current = note;
    setCurrentNote(note);
    setCurrentBeat(0);

    // 2. Count-in phase
    setPhase('counting');
    await playCountIn({
      bpm: cfg.bpm,
      timeSignature: '4/4',
      volume: 15,
      onBeat: (beat) => {
        if (cycleIdRef.current === id) {
          setCurrentBeat(beat);
        }
      },
    });
    if (cycleIdRef.current !== id) return;

    // 3. Reveal phase - show note positions and play sound
    setPhase('revealing');
    playNoteByName(note, 3, 2.0);

    // 4. Hold reveal
    const revealMs = (60 / cfg.bpm) * cfg.revealBeats * 1000;
    await delay(revealMs);
    if (cycleIdRef.current !== id) return;

    // 5. Next cycle
    runCycle(id);
  }, []);

  const start = useCallback(() => {
    const id = ++cycleIdRef.current;
    setIsRunning(true);
    runCycle(id);
  }, [runCycle]);

  const stop = useCallback(() => {
    cycleIdRef.current++;
    setIsRunning(false);
    setPhase('idle');
    setCurrentNote(null);
    setCurrentBeat(0);
  }, []);

  const updateConfig = useCallback((partial: Partial<NoteTrainerConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  return {
    phase,
    currentNote,
    currentBeat,
    isRunning,
    config,
    getNotePool,
    start,
    stop,
    updateConfig,
  };
}
