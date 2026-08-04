/**
 * Generate scale practice exercises as FretNote sequences and AlphaTex.
 *
 * Produces 12 exercise types from any scale + key, optionally constrained
 * to a fretboard position. Output is rendered by AlphaTexStatic.
 */

import {
  getScalePositions,
  getScaleNotesOnFretboard,
  getScaleNotesOnString,
  type FretNote,
  type ScalePosition,
} from './scalePositions';
import { fretNotesToAlphaTex, type AlphaTexDuration } from './alphatexSerializer';

export type ExerciseType =
  | 'ascending'
  | 'descending'
  | 'up-and-back'
  | 'thirds'
  | 'fourths'
  | 'triplet-groups'
  | 'four-note-groups'
  | 'skip-one'
  | 'pendulum'
  | 'random-intervals'
  | 'two-string'
  | 'string-skipping'
  | 'random';

export const EXERCISE_TYPES: { value: ExerciseType; label: string; description: string }[] = [
  { value: 'ascending', label: 'Ascending Run', description: 'Play all scale notes from lowest to highest pitch.' },
  { value: 'descending', label: 'Descending Run', description: 'Play all scale notes from highest to lowest pitch.' },
  { value: 'up-and-back', label: 'Up & Back', description: 'Ascending run immediately followed by descending.' },
  { value: 'thirds', label: 'Thirds', description: 'Note pairs separated by one scale degree (1-3, 2-4...).' },
  { value: 'fourths', label: 'Fourths', description: 'Note pairs separated by two scale degrees (1-4, 2-5...).' },
  { value: 'triplet-groups', label: 'Triplet Groups', description: 'Ascending groups of 3 notes (1-2-3, 2-3-4...).' },
  { value: 'four-note-groups', label: 'Four-Note Groups', description: 'Ascending groups of 4 notes (1-2-3-4, 2-3-4-5...).' },
  { value: 'skip-one', label: 'Skip One', description: 'Alternate up two, down one (1-2-3, 2-3-4 zig-zag).' },
  { value: 'pendulum', label: 'Pendulum', description: 'Alternate up three, down two for rolling motion.' },
  { value: 'random-intervals', label: 'Random Intervals', description: 'Random note pairs from the scale.' },
  { value: 'two-string', label: 'Two-String Pattern', description: 'Cross between adjacent string pairs.' },
  { value: 'string-skipping', label: 'String Skipping', description: 'Skip strings between notes for pick accuracy.' },
  { value: 'random', label: 'Random (Surprise Me)', description: 'Pick a random exercise type each time.' },
];

export interface ExerciseConfig {
  root: string;
  scaleType: string;
  exerciseType: ExerciseType;
  /** 1-based position index, or null for full neck. */
  position: number | null;
  /** Cosmetic only (no playback); defaults to 120 and the marker is hidden. */
  tempo?: number;
  duration: AlphaTexDuration;
  bars: number;
}

export interface GeneratedExercise {
  notes: FretNote[];
  alphatex: string;
  description: string;
  exerciseType: ExerciseType;
  positionRange: [number, number] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function notesPerBar(duration: AlphaTexDuration): number {
  if (duration === '8') return 8;
  if (duration === '16') return 16;
  return 12; // mixed average
}

function getPool(config: ExerciseConfig): { pool: FretNote[]; range: [number, number] | null } {
  if (config.position === null) {
    const pool = getScaleNotesOnFretboard(config.root, config.scaleType).sort(
      (a, b) => a.midiNote - b.midiNote,
    );
    return { pool, range: null };
  }
  const positions = getScalePositions(config.root, config.scaleType);
  const pos: ScalePosition | undefined = positions[config.position - 1] ?? positions[0];
  if (!pos) return { pool: [], range: null };
  return { pool: pos.notes, range: pos.fretRange };
}

// ---------------------------------------------------------------------------
// Per-exercise sequence builders
// ---------------------------------------------------------------------------

function genAscending(pool: FretNote[], target: number): FretNote[] {
  const out: FretNote[] = [];
  for (let i = 0; out.length < target && pool.length > 0; i++) {
    out.push(pool[i % pool.length]);
  }
  return out;
}

function genDescending(pool: FretNote[], target: number): FretNote[] {
  const reversed = [...pool].reverse();
  return genAscending(reversed, target);
}

function genUpAndBack(pool: FretNote[], target: number): FretNote[] {
  if (pool.length === 0) return [];
  const cycle = [...pool, ...[...pool].reverse().slice(1, -1)];
  const out: FretNote[] = [];
  for (let i = 0; out.length < target; i++) {
    out.push(cycle[i % cycle.length]);
  }
  return out;
}

/** Generic sequence: pairs/triplets/groups stepping up the scale by stride. */
function genSequence(pool: FretNote[], groupSize: number, target: number): FretNote[] {
  if (pool.length < groupSize) return genAscending(pool, target);
  const out: FretNote[] = [];
  let start = 0;
  while (out.length < target) {
    for (let i = 0; i < groupSize && out.length < target; i++) {
      out.push(pool[(start + i) % pool.length]);
    }
    start = (start + 1) % pool.length;
  }
  return out;
}

/** Skip-one: up two scale degrees, down one. Produces 1-2-3, 2-3-4, 3-4-5... */
function genSkipOne(pool: FretNote[], target: number): FretNote[] {
  if (pool.length < 3) return genAscending(pool, target);
  const out: FretNote[] = [];
  let idx = 0;
  let phase = 0; // 0: up two, 1: down one
  while (out.length < target) {
    out.push(pool[idx % pool.length]);
    if (phase === 0) {
      idx += 2;
      phase = 1;
    } else {
      idx -= 1;
      phase = 0;
    }
    if (idx < 0) idx = 0;
    if (idx >= pool.length) idx = pool.length - 1;
  }
  return out;
}

/** Pendulum: 1-4, 2-5, 3-6 ... (up three, down two). */
function genPendulum(pool: FretNote[], target: number): FretNote[] {
  if (pool.length < 4) return genAscending(pool, target);
  const out: FretNote[] = [];
  let base = 0;
  while (out.length < target) {
    out.push(pool[base % pool.length]);
    if (out.length < target) out.push(pool[(base + 3) % pool.length]);
    base = (base + 1) % pool.length;
  }
  return out;
}

function genRandomIntervals(pool: FretNote[], target: number): FretNote[] {
  if (pool.length === 0) return [];
  const out: FretNote[] = [];
  while (out.length < target) {
    const a = randInt(pool.length);
    let b = randInt(pool.length);
    if (b === a) b = (b + 1) % pool.length;
    out.push(pool[a]);
    out.push(pool[b]);
  }
  return out.slice(0, target);
}

/** Cross adjacent string pairs in a down-up pattern. */
function genTwoString(config: ExerciseConfig, range: [number, number] | null, target: number): FretNote[] {
  const [low, high] = range ?? [0, 15];
  const out: FretNote[] = [];
  // walk string pairs (0,1), (1,2), (2,3) ...
  for (let s = 0; s < 5 && out.length < target; s++) {
    const lo = getScaleNotesOnString(config.root, config.scaleType, s, low, high);
    const hi = getScaleNotesOnString(config.root, config.scaleType, s + 1, low, high);
    const pairLen = Math.min(lo.length, hi.length);
    for (let i = 0; i < pairLen && out.length < target; i++) {
      out.push(lo[i]);
      out.push(hi[i]);
    }
  }
  // Pad by cycling
  if (out.length > 0) {
    let i = 0;
    while (out.length < target) {
      out.push(out[i % out.length]);
      i++;
    }
  }
  return out.slice(0, target);
}

/** String skipping: alternate between non-adjacent strings. */
function genStringSkipping(config: ExerciseConfig, range: [number, number] | null, target: number): FretNote[] {
  const [low, high] = range ?? [0, 15];
  const out: FretNote[] = [];
  // walk pairs (0,2), (1,3), (2,4), (3,5)
  for (let s = 0; s < 4 && out.length < target; s++) {
    const lo = getScaleNotesOnString(config.root, config.scaleType, s, low, high);
    const hi = getScaleNotesOnString(config.root, config.scaleType, s + 2, low, high);
    const pairLen = Math.min(lo.length, hi.length);
    for (let i = 0; i < pairLen && out.length < target; i++) {
      out.push(lo[i]);
      out.push(hi[i]);
    }
  }
  if (out.length > 0) {
    let i = 0;
    while (out.length < target) {
      out.push(out[i % out.length]);
      i++;
    }
  }
  return out.slice(0, target);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const CONCRETE_TYPES: Exclude<ExerciseType, 'random'>[] = [
  'ascending',
  'descending',
  'up-and-back',
  'thirds',
  'fourths',
  'triplet-groups',
  'four-note-groups',
  'skip-one',
  'pendulum',
  'random-intervals',
  'two-string',
  'string-skipping',
];

export function generateExercise(config: ExerciseConfig): GeneratedExercise {
  const { pool, range } = getPool(config);
  const target = Math.max(8, config.bars * notesPerBar(config.duration));

  const effectiveType: Exclude<ExerciseType, 'random'> =
    config.exerciseType === 'random'
      ? CONCRETE_TYPES[randInt(CONCRETE_TYPES.length)]
      : config.exerciseType;

  let notes: FretNote[];
  switch (effectiveType) {
    case 'ascending':
      notes = genAscending(pool, target);
      break;
    case 'descending':
      notes = genDescending(pool, target);
      break;
    case 'up-and-back':
      notes = genUpAndBack(pool, target);
      break;
    case 'thirds':
      notes = genThirds(pool, target);
      break;
    case 'fourths':
      notes = genFourths(pool, target);
      break;
    case 'triplet-groups':
      notes = genSequence(pool, 3, target);
      break;
    case 'four-note-groups':
      notes = genSequence(pool, 4, target);
      break;
    case 'skip-one':
      notes = genSkipOne(pool, target);
      break;
    case 'pendulum':
      notes = genPendulum(pool, target);
      break;
    case 'random-intervals':
      notes = genRandomIntervals(pool, target);
      break;
    case 'two-string':
      notes = genTwoString(config, range, target);
      break;
    case 'string-skipping':
      notes = genStringSkipping(config, range, target);
      break;
  }

  const positionLabel = config.position === null ? 'Full Neck' : `Position ${config.position}`;
  const exerciseLabel = EXERCISE_TYPES.find((t) => t.value === effectiveType)?.label ?? effectiveType;
  const description = `${config.root} ${config.scaleType} — ${exerciseLabel} (${positionLabel})`;

  const alphatex = fretNotesToAlphaTex(notes, {
    title: description,
    // No playback, so tempo is cosmetic only; the marker is hidden at render time.
    tempo: config.tempo ?? 120,
    duration: config.duration,
  });

  return {
    notes,
    alphatex,
    description,
    exerciseType: effectiveType,
    positionRange: range,
  };
}

// ---------------------------------------------------------------------------
// Thirds / Fourths (interval-stride sequences)
// ---------------------------------------------------------------------------

/** Note pairs separated by ONE scale degree: 1-3, 2-4, 3-5 ... */
function genThirds(pool: FretNote[], target: number): FretNote[] {
  if (pool.length < 3) return genAscending(pool, target);
  const out: FretNote[] = [];
  let i = 0;
  while (out.length < target) {
    out.push(pool[i % pool.length]);
    if (out.length < target) out.push(pool[(i + 2) % pool.length]);
    i++;
  }
  return out;
}

/** Note pairs separated by TWO scale degrees: 1-4, 2-5, 3-6 ... */
function genFourths(pool: FretNote[], target: number): FretNote[] {
  if (pool.length < 4) return genAscending(pool, target);
  const out: FretNote[] = [];
  let i = 0;
  while (out.length < target) {
    out.push(pool[i % pool.length]);
    if (out.length < target) out.push(pool[(i + 3) % pool.length]);
    i++;
  }
  return out;
}
