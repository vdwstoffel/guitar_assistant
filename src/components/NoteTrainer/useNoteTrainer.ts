import { useState, useRef, useCallback, useEffect } from 'react';
import { PitchDetector } from 'pitchy';
import { NOTES, getNoteIndex } from '@/lib/musicTheory';
import { playCountIn } from '@/lib/clickGenerator';
import {
  playNoteByName,
  speakNoteName,
  stopSpokenNote,
  playCorrectCue,
  playIncorrectCue,
} from '@/lib/audioGenerator';
import { freqToNote } from '@/lib/tuner/presets';
import { withInputDevice } from '@/lib/audioSink';

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
  MicStatus,
} from './types';

const MIC_FFT_SIZE = 2048;
const MIC_CLARITY_THRESHOLD = 0.92;
const MIC_MIN_FREQ = 60;
const MIC_MAX_FREQ = 1500;
// Ignore mic input briefly at the start of reveal to avoid catching the
// initial pluck transient / any residual audio from the count-in click.
const MIC_MATCH_GRACE_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fisher-Yates shuffle (in place)
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Deck-based picker: deals every note in the pool once before reshuffling.
// Guarantees uniform coverage — no clustering. If a reshuffle would repeat
// the previous note as the next draw, swap it with a later slot.
function drawNext(pool: readonly string[], deck: string[], lastNote: string | null): string {
  if (deck.length === 0) {
    deck.push(...shuffle([...pool]));
    if (deck.length > 1 && deck[0] === lastNote) {
      const j = 1 + Math.floor(Math.random() * (deck.length - 1));
      [deck[0], deck[j]] = [deck[j], deck[0]];
    }
  }
  return deck.shift()!;
}

// Announce the note through the app-routed AudioContext (so it plays on the
// selected output device — the browser's speechSynthesis can't be routed).
function speakNote(note: string, volume: number): void {
  void speakNoteName(note, volume);
}

function cancelSpeech(): void {
  stopSpokenNote();
}

export function useNoteTrainer() {
  const [phase, setPhase] = useState<TrainerPhase>('idle');
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<NoteTrainerConfig>(DEFAULT_CONFIG);
  const [micStatus, setMicStatus] = useState<MicStatus>('off');
  const [micError, setMicError] = useState<string | null>(null);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [matchHit, setMatchHit] = useState(false);
  const [missedNote, setMissedNote] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Refs for async loop management
  const cycleIdRef = useRef(0);
  const configRef = useRef(config);
  const lastNoteRef = useRef<string | null>(null);
  const streakRef = useRef(0);
  const deckRef = useRef<string[]>([]);
  const deckPoolRef = useRef<'natural' | 'all' | null>(null);

  // Mic / pitch detection refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  // Set during reveal to receive pitch-class notifications
  const onPitchRef = useRef<((noteName: string) => void) | null>(null);

  // Keep configRef in sync
  configRef.current = config;

  const getNotePool = useCallback((): readonly string[] => {
    return configRef.current.notePool === 'natural' ? NATURAL_NOTES : NOTES;
  }, []);

  const stopMic = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    detectorRef.current = null;
    bufferRef.current = null;
    onPitchRef.current = null;
    setDetectedNote(null);
    setMicStatus('off');
  }, []);

  const micTick = useCallback(() => {
    const ctx = audioContextRef.current;
    const analyser = analyserRef.current;
    const detector = detectorRef.current;
    const buf = bufferRef.current;
    if (!ctx || !analyser || !detector || !buf) return;

    analyser.getFloatTimeDomainData(buf);
    const [pitch, clarity] = detector.findPitch(buf, ctx.sampleRate);

    if (clarity >= MIC_CLARITY_THRESHOLD && pitch >= MIC_MIN_FREQ && pitch <= MIC_MAX_FREQ) {
      const { name } = freqToNote(pitch);
      setDetectedNote(name);
      onPitchRef.current?.(name);
    }

    rafRef.current = requestAnimationFrame(micTick);
  }, []);

  const startMic = useCallback(async () => {
    if (micStatus === 'listening' || micStatus === 'requesting') return;
    setMicStatus('requesting');
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: await withInputDevice({
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }),
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = MIC_FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize);
      bufferRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));

      setMicStatus('listening');
      rafRef.current = requestAnimationFrame(micTick);
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setMicStatus('denied');
        setMicError('Microphone access denied');
      } else {
        setMicStatus('error');
        setMicError(e.message || 'Failed to start microphone');
      }
      stopMic();
    }
  }, [micStatus, micTick, stopMic]);

  // Wait for the first stable pitch the user plays and commit it as the answer.
  // Correct pitch class → hit; anything else → miss. Timeout → miss.
  const waitForMatchOrTimeout = useCallback(
    (target: string, timeoutMs: number, id: number): Promise<boolean> => {
      return new Promise((resolve) => {
        let done = false;
        // Require the same pitch class over N consecutive detector frames before
        // committing, so a plucked-string transient doesn't count as the answer.
        const STABLE_FRAMES_REQUIRED = 3;
        let stableNote: string | null = null;
        let stableCount = 0;

        const finish = (hit: boolean) => {
          if (done) return;
          done = true;
          onPitchRef.current = null;
          clearTimeout(timer);
          resolve(hit);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        // Grace period so a residual transient doesn't count as the answer.
        const graceUntil = performance.now() + MIC_MATCH_GRACE_MS;
        onPitchRef.current = (name: string) => {
          if (cycleIdRef.current !== id) return finish(false);
          if (performance.now() < graceUntil) return;

          if (name === stableNote) {
            stableCount++;
          } else {
            stableNote = name;
            stableCount = 1;
          }
          if (stableCount < STABLE_FRAMES_REQUIRED) return;

          if (name === target) {
            setMatchHit(true);
            playCorrectCue(configRef.current.volume); // audio cue so no need to watch the screen
            // Brief celebratory hold so the ✓ is visible.
            setTimeout(() => finish(true), 250);
          } else {
            // Wrong pitch — freeze the display so the user sees what they played.
            setMissedNote(name);
            playIncorrectCue(configRef.current.volume);
            setTimeout(() => finish(false), 700);
          }
        };
      });
    },
    []
  );

  const runCycle = useCallback(async (id: number) => {
    const cfg = configRef.current;
    const pool = cfg.notePool === 'natural' ? NATURAL_NOTES : NOTES;

    // Reset the deck if the pool changed (user toggled Natural ↔ All 12)
    if (deckPoolRef.current !== cfg.notePool) {
      deckRef.current = [];
      deckPoolRef.current = cfg.notePool;
    }

    // 1. Draw next note from the shuffled deck
    const note = drawNext(pool, deckRef.current, lastNoteRef.current);
    lastNoteRef.current = note;
    setCurrentNote(note);
    setCurrentBeat(0);
    setMatchHit(false);
    setMissedNote(null);

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

    // 3. Reveal phase
    setPhase('revealing');
    const octave = findRevealOctave(note, cfg.enabledStrings);
    // Only play the target sound when we're NOT listening — otherwise it
    // both spoils the answer and would self-match through the speakers.
    if (!cfg.listenEnabled) {
      playNoteByName(note, octave, 2.0, cfg.volume);
    }

    // 4. Hold reveal — either fixed timer, or wait-for-match with a longer window
    const beatMs = 60000 / cfg.bpm;
    if (cfg.listenEnabled) {
      // Give the user up to 8 beats to play the note; auto-advance sooner on hit.
      const listenMs = beatMs * 8;
      const hit = await waitForMatchOrTimeout(note, listenMs, id);
      if (cycleIdRef.current !== id) return;

      // Score the outcome
      setTotal((t) => t + 1);
      if (hit) {
        setCorrect((c) => c + 1);
        const newStreak = streakRef.current + 1;
        streakRef.current = newStreak;
        setStreak(newStreak);

        // Check for exercise completion
        if (cfg.targetStreak > 0 && newStreak >= cfg.targetStreak) {
          setCompleted(true);
          setIsRunning(false);
          setPhase('idle');
          onPitchRef.current = null;
          stopMic();
          return;
        }
      } else {
        streakRef.current = 0;
        setStreak(0);
      }
    } else {
      await delay(beatMs * cfg.revealBeats);
    }
    if (cycleIdRef.current !== id) return;

    // 5. Next cycle
    runCycle(id);
  }, [waitForMatchOrTimeout]);

  const start = useCallback(() => {
    const id = ++cycleIdRef.current;
    // Reset score for a fresh run
    setCorrect(0);
    setTotal(0);
    setStreak(0);
    streakRef.current = 0;
    setCompleted(false);
    // Fresh deck each run so the sequence isn't determined by leftovers
    deckRef.current = [];
    deckPoolRef.current = null;
    setIsRunning(true);
    if (configRef.current.listenEnabled) {
      void startMic();
    }
    runCycle(id);
  }, [runCycle, startMic]);

  const stop = useCallback(() => {
    cycleIdRef.current++;
    cancelSpeech();
    onPitchRef.current = null;
    setIsRunning(false);
    setPhase('idle');
    setCurrentNote(null);
    setCurrentBeat(0);
    setMatchHit(false);
    setMissedNote(null);
    stopMic();
  }, [stopMic]);

  const updateConfig = useCallback((partial: Partial<NoteTrainerConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  // Start/stop the mic when the listen toggle flips while running.
  useEffect(() => {
    if (!isRunning) return;
    if (config.listenEnabled && micStatus === 'off') {
      void startMic();
    } else if (!config.listenEnabled && (micStatus === 'listening' || micStatus === 'requesting')) {
      stopMic();
    }
  }, [config.listenEnabled, isRunning, micStatus, startMic, stopMic]);

  // Release mic on unmount
  useEffect(() => {
    return () => { stopMic(); };
  }, [stopMic]);

  return {
    phase,
    currentNote,
    currentBeat,
    isRunning,
    config,
    micStatus,
    micError,
    detectedNote,
    matchHit,
    missedNote,
    correct,
    total,
    streak,
    completed,
    getNotePool,
    start,
    stop,
    updateConfig,
  };
}
