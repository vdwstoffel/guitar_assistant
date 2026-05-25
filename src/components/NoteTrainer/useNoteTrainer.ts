import { useState, useRef, useCallback } from 'react';
import { NOTES, getNoteIndex } from '@/lib/musicTheory';
import { playCountIn } from '@/lib/clickGenerator';
import { playNoteByName } from '@/lib/audioGenerator';

// MIDI of each open string in standard tuning (low E → high E)
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64] as const;

// Find the lowest (string, fret) match for a note within frets 1-12 on enabled strings,
// and return the corresponding octave so audio pitch matches the visible position.
function findRevealOctave(note: string, enabledStrings: boolean[]): number {
  const targetPc = getNoteIndex(note);
  let lowestMidi = Infinity;
  for (let s = 0; s < 6; s++) {
    if (!enabledStrings[s]) continue;
    for (let fret = 1; fret <= 12; fret++) {
      const midi = OPEN_STRING_MIDI[s] + fret;
      if (((midi % 12) + 12) % 12 === targetPc) {
        if (midi < lowestMidi) lowestMidi = midi;
        break;
      }
    }
  }
  if (lowestMidi === Infinity) return 3;
  return Math.floor(lowestMidi / 12) - 1;
}
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

function speakNote(note: string, volume: number): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const spoken = note.replace('#', ' sharp');
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.volume = Math.max(0, Math.min(1, volume / 100));
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

function cancelSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
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

    // 1b. Speak the note name so the user can practice without looking
    if (cfg.voiceEnabled) {
      speakNote(note, cfg.volume);
    }

    // 2. Count-in phase
    setPhase('counting');
    await playCountIn({
      bpm: cfg.bpm,
      timeSignature: '4/4',
      volume: cfg.volume * 0.3,
      onBeat: (beat) => {
        if (cycleIdRef.current === id) {
          setCurrentBeat(beat);
        }
      },
    });
    if (cycleIdRef.current !== id) return;

    // 3. Reveal phase - show note positions and play sound
    setPhase('revealing');
    const octave = findRevealOctave(note, cfg.enabledStrings);
    playNoteByName(note, octave, 2.0, cfg.volume);

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
    cancelSpeech();
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
