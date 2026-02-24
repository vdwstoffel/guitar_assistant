/**
 * Converts parsed SNG data to AlphaTex format for rendering with alphaTab.
 *
 * AlphaTex reference: https://alphatab.net/docs/alphatex/introduction
 * SNG data comes from sngParser.ts
 */
import { SongData, Note, Beat, BendValue, ChordTemplate } from "./sngParser";

// Standard tuning MIDI notes for each string (high to low): E4 B3 G3 D3 A2 E2
const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];
// Standard bass tuning MIDI notes (high to low): G2 D2 A1 E1
const STANDARD_BASS_TUNING = [43, 38, 33, 28];
const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function getTuningString(tuningOffsets: number[], isBass: boolean): string {
  // tuningOffsets: semitone offsets from standard tuning per string
  // SNG strings: 0=low E, 1=A, 2=D, 3=G, 4=B, 5=high E
  // AlphaTex tuning: high to low (string 1 = high E)
  const numStrings = isBass ? 4 : 6;
  const baseTuning = isBass ? STANDARD_BASS_TUNING : STANDARD_TUNING;
  return tuningOffsets
    .slice(0, numStrings)
    .map((offset, sngString) => {
      const standardIdx = (numStrings - 1) - sngString;
      return midiToNoteName(baseTuning[standardIdx] + offset);
    })
    .reverse() // AlphaTex expects high to low
    .join(" ");
}

/** Get full arrangement notes by merging max difficulty per phrase */
function getFullArrangementNotes(song: SongData): Note[] {
  const allNotes: Note[] = [];
  for (const pi of song.phraseIterations) {
    const phrase = song.phrases[pi.phraseId];
    if (!phrase) continue;
    const level = song.levels.find(
      (l) => l.difficulty === phrase.maxDifficulty
    );
    if (!level) continue;
    const piEnd = pi.endTime > 0 ? pi.endTime : Infinity;
    const notes = level.notes.filter(
      (n) => n.time >= pi.time && n.time < piEnd
    );
    allNotes.push(...notes);
  }
  allNotes.sort((a, b) => a.time - b.time);
  return allNotes;
}

interface Duration {
  value: number;
  dotted: boolean;
}

/** Find the closest note duration (with dotted support) for a given time */
function quantizeDuration(durationSec: number, bpm: number): Duration {
  const beatDuration = 60 / bpm; // seconds per quarter note
  const ratio = durationSec / beatDuration;

  // Candidates ordered from longest to shortest, interleaving dotted values
  const candidates: { value: number; dotted: boolean; beats: number }[] = [
    { value: 1, dotted: true, beats: 6 },    // dotted whole
    { value: 1, dotted: false, beats: 4 },    // whole
    { value: 2, dotted: true, beats: 3 },     // dotted half
    { value: 2, dotted: false, beats: 2 },    // half
    { value: 4, dotted: true, beats: 1.5 },   // dotted quarter
    { value: 4, dotted: false, beats: 1 },    // quarter
    { value: 8, dotted: true, beats: 0.75 },  // dotted eighth
    { value: 8, dotted: false, beats: 0.5 },  // eighth
    { value: 16, dotted: true, beats: 0.375 }, // dotted sixteenth
    { value: 16, dotted: false, beats: 0.25 }, // sixteenth
    { value: 32, dotted: false, beats: 0.125 }, // thirty-second
  ];

  let best = candidates[candidates.length - 1];
  let bestDiff = Infinity;
  for (const c of candidates) {
    const diff = Math.abs(ratio - c.beats);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return { value: best.value, dotted: best.dotted };
}

/** Format a duration as an AlphaTex string (just the number, e.g., "4") */
function formatDuration(dur: Duration): string {
  return `${dur.value}`;
}

/**
 * Combine dotted flag with existing beat effects into a single {...} block.
 * AlphaTex dotted is a beat effect `d`, so `{d v}` for dotted + vibrato.
 * @param dur - duration (checked for dotted flag)
 * @param beatEfx - existing beat effects string like `{ch "A5" v}` or empty
 */
function combineBeatEffects(dur: Duration, beatEfx: string): string {
  if (!dur.dotted && !beatEfx) return "";
  const parts: string[] = [];
  if (dur.dotted) parts.push("d");
  if (beatEfx) {
    // Strip outer braces from existing beat effects and add contents
    parts.push(beatEfx.slice(1, -1).trim());
  }
  return `{${parts.join(" ")}}`;
}

/** Get the beat count for a duration */
function durationToBeats(dur: Duration): number {
  const base = 4 / dur.value;
  return dur.dotted ? base * 1.5 : base;
}

/** Get note-level effects (go on individual notes, before duration) */
function getNoteEffects(note: Note): string {
  const effects: string[] = [];

  // Hammer-on/pull-off: mask bit 1 = 0x2
  if (note.mask & 0x2) effects.push("h");
  // Palm mute: mask bit 9 = 0x200
  if (note.mask & 0x200) effects.push("pm");
  // Slide (pitched or unpitched — AlphaTex only has generic slide)
  if (note.slideTo > 0 || note.slideUnpitchTo !== 0) effects.push("sl");
  // Tap
  if (note.tap > 0) effects.push("t");
  // Bend - use full curve from bendValues when available
  if (note.maxBend > 0) {
    effects.push(formatBend(note.bendValues, note.maxBend));
  }

  if (effects.length === 0) return "";
  return `{${effects.join(" ")}}`;
}

/** Format bend effect from bend values array */
function formatBend(bendValues: BendValue[], maxBend: number): string {
  const peakQ = Math.round(maxBend * 4);
  if (bendValues.length === 0) {
    return `b (0 ${peakQ} ${peakQ} 0)`;
  }
  // Use actual start/end from the bend curve
  const startQ = Math.round(bendValues[0].step * 4);
  const endQ = Math.round(bendValues[bendValues.length - 1].step * 4);
  return `b (${startQ} ${peakQ} ${peakQ} ${endQ})`;
}

/** Get beat-level effects (go after duration) */
function getBeatEffects(
  note: Note,
  chordTemplates: ChordTemplate[]
): string {
  const effects: string[] = [];

  // Chord name
  if (note.chordId >= 0 && chordTemplates[note.chordId]?.name) {
    const name = chordTemplates[note.chordId].name.trim();
    if (name) effects.push(`ch "${name}"`);
  }

  if (note.vibrato > 0) effects.push("v");
  if (note.slap > 0) effects.push("ds");

  if (effects.length === 0) return "";
  return `{${effects.join(" ")}}`;
}

function formatChord(
  note: Note,
  chordTemplates: ChordTemplate[],
  noteEffects: string,
  numStrings: number
): string | null {
  if (note.chordId < 0 || !chordTemplates[note.chordId]) return null;

  const ct = chordTemplates[note.chordId];
  const chordNotes: string[] = [];
  for (let s = 0; s < numStrings; s++) {
    if (ct.frets[s] !== 255) {
      // SNG string 0=lowest → AlphaTex string N, SNG string N-1=highest → AlphaTex string 1
      chordNotes.push(`${ct.frets[s]}.${numStrings - s}${noteEffects}`);
    }
  }
  if (chordNotes.length > 1) {
    return `(${chordNotes.join(" ")})`;
  } else if (chordNotes.length === 1) {
    return chordNotes[0];
  }
  return null;
}

/** Format a section name for display (clean up SNG naming conventions) */
function formatSectionName(name: string): string {
  // Skip non-musical sections
  if (name === "noguitar" || name === "empty") return "";
  // Insert space before capitals: "preChorus" -> "pre Chorus"
  const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Capitalize first letter
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Group beats into measures using the SNG beat grid's native measure field.
 * Returns measures with their beats, start/end times, and beats-per-bar.
 */
function groupBeatsIntoMeasures(
  beats: Beat[],
  startIdx: number
): { startTime: number; endTime: number; beats: Beat[]; beatsPerBar: number }[] {
  const measures: { startTime: number; endTime: number; beats: Beat[]; beatsPerBar: number }[] = [];
  let currentMeasure = beats[startIdx]?.measure ?? 0;
  let currentBeats: Beat[] = [];

  for (let i = startIdx; i < beats.length; i++) {
    if (beats[i].measure !== currentMeasure) {
      if (currentBeats.length > 0) {
        measures.push({
          startTime: currentBeats[0].time,
          endTime: beats[i].time,
          beats: currentBeats,
          beatsPerBar: currentBeats.length,
        });
      }
      currentMeasure = beats[i].measure;
      currentBeats = [beats[i]];
    } else {
      currentBeats.push(beats[i]);
    }
  }
  // Last measure
  if (currentBeats.length > 0) {
    const lastBeat = currentBeats[currentBeats.length - 1];
    const estimatedBeatDur = currentBeats.length > 1
      ? currentBeats[1].time - currentBeats[0].time
      : 60 / 120;
    measures.push({
      startTime: currentBeats[0].time,
      endTime: lastBeat.time + estimatedBeatDur,
      beats: currentBeats,
      beatsPerBar: currentBeats.length,
    });
  }
  return measures;
}

/** Compute local BPM from a measure's beats */
function measureBpm(measureBeats: Beat[]): number {
  if (measureBeats.length < 2) return 120;
  // Average beat duration across the measure for stability
  const totalTime = measureBeats[measureBeats.length - 1].time - measureBeats[0].time;
  const intervals = measureBeats.length - 1;
  return Math.round(60 / (totalTime / intervals));
}

export interface AlphaTexOptions {
  /** Maximum number of measures to generate (0 = unlimited) */
  maxMeasures?: number;
}

/**
 * Generate AlphaTex string from parsed SNG data.
 * The output can be rendered by alphaTab.
 */
export function generateAlphaTex(
  song: SongData,
  arrangementName: string,
  songTitle: string,
  artistName: string,
  options: AlphaTexOptions = {}
): string {
  const { maxMeasures = 0 } = options;
  const notes = getFullArrangementNotes(song);
  const isBass = arrangementName.toLowerCase() === "bass";
  const numStrings = isBass ? 4 : 6;
  const tuning = getTuningString(song.metadata.tuning, isBass);

  // Initial BPM from first beats
  const initialBpm = getBPM(song);

  const lines: string[] = [];
  lines.push(`\\title "${songTitle}"`);
  lines.push(`\\subtitle "${arrangementName}"`);
  lines.push(`\\artist "${artistName}"`);
  lines.push(`\\tempo ${initialBpm}`);
  lines.push(`\\ts 4 4`);
  lines.push(`\\tuning ${tuning}`);
  lines.push(`\\instrument ${isBass ? 34 : 25}`);
  lines.push(`\\staff{score tabs}`);
  lines.push(`.`); // End of metadata

  // Find the beat where the first note falls so we can align measure
  // boundaries to where the music actually starts.
  const firstNoteTime = notes.length > 0 ? notes[0].time : song.beats[0]?.time ?? 0;
  let beatOffset = 0;
  for (let i = 0; i < song.beats.length; i++) {
    if (song.beats[i].time >= firstNoteTime - 0.02) {
      beatOffset = i;
      break;
    }
  }

  // Calculate rest bars before the first note
  const groupStartTime = song.beats[beatOffset]?.time ?? 0;
  // Use initial BPM for rest bar estimation
  const barDuration = (4 * 60) / initialBpm;
  const restBars = Math.round(groupStartTime / barDuration);
  for (let i = 0; i < restBars; i++) {
    lines.push(`r.1 |`);
  }

  // Group beats into measures using the SNG beat grid's native measure field
  const musicalMeasures = groupBeatsIntoMeasures(song.beats, beatOffset);

  // Build section-to-measure map from SNG sections
  const sectionAtMeasure = new Map<number, string>();
  for (const section of song.sections) {
    const mi = musicalMeasures.findIndex(
      (m) => section.startTime >= m.startTime - 0.02 && section.startTime < m.endTime
    );
    if (mi >= 0) {
      const name = formatSectionName(section.name);
      if (name) sectionAtMeasure.set(mi, name);
    }
  }

  // Track time signature and tempo for change detection
  let currentBeatsPerBar = 4;
  let currentBpm = initialBpm;

  // For each musical measure, generate AlphaTex
  let noteIdx = 0;
  const measureLimit =
    maxMeasures > 0
      ? Math.min(musicalMeasures.length, maxMeasures)
      : musicalMeasures.length;

  for (let mi = 0; mi < measureLimit; mi++) {
    const measure = musicalMeasures[mi];
    const localBpm = measureBpm(measure.beats);
    const barMetadata: string[] = [];

    // Emit section marker
    if (sectionAtMeasure.has(mi)) {
      barMetadata.push(`\\section "${sectionAtMeasure.get(mi)}"`);
    }

    // Emit time signature change
    if (measure.beatsPerBar !== currentBeatsPerBar) {
      currentBeatsPerBar = measure.beatsPerBar;
      barMetadata.push(`\\ts ${currentBeatsPerBar} 4`);
    }

    // Emit tempo change (> 2 BPM threshold)
    if (Math.abs(localBpm - currentBpm) > 2) {
      currentBpm = localBpm;
      barMetadata.push(`\\tempo ${currentBpm}`);
    }

    if (barMetadata.length > 0) {
      lines.push(barMetadata.join(" "));
    }

    // Collect notes in this measure
    const measureNotes: Note[] = [];
    while (noteIdx < notes.length && notes[noteIdx].time < measure.endTime) {
      if (notes[noteIdx].time >= measure.startTime) {
        measureNotes.push(notes[noteIdx]);
      }
      noteIdx++;
    }

    if (measureNotes.length === 0) {
      // Use a rest that matches the current time signature
      const fullBarSec = (currentBeatsPerBar * 60) / localBpm;
      const fullBarDur = quantizeDuration(fullBarSec, localBpm);
      const fullBarEfx = fullBarDur.dotted ? "{d}" : "";
      lines.push(`r.${formatDuration(fullBarDur)}${fullBarEfx} |`);
      continue;
    }

    // Group simultaneous notes (chords) - within 10ms tolerance
    const beatGroups: Note[][] = [];
    let currentGroup: Note[] = [];
    let currentTime = -1;

    for (const note of measureNotes) {
      if (Math.abs(note.time - currentTime) < 0.01) {
        currentGroup.push(note);
      } else {
        if (currentGroup.length > 0) beatGroups.push(currentGroup);
        currentGroup = [note];
        currentTime = note.time;
      }
    }
    if (currentGroup.length > 0) beatGroups.push(currentGroup);

    // Generate AlphaTex for each beat group with sustain-based durations and rests
    const beatStrings: string[] = [];
    let totalBeats = 0;

    for (let i = 0; i < beatGroups.length; i++) {
      const group = beatGroups[i];
      const noteStartTime = group[0].time;
      const nextTime = beatGroups[i + 1]?.[0]?.time ?? measure.endTime;
      const maxAvailable = nextTime - noteStartTime;

      // Use sustain if available, otherwise fall back to gap-based
      const sustainSec = group[0].sustain > 0 ? group[0].sustain : maxAvailable;
      const noteDurSec = Math.min(sustainSec, maxAvailable);
      const dur = quantizeDuration(noteDurSec, localBpm);
      const durBeats = durationToBeats(dur);

      // Don't exceed the measure budget
      if (totalBeats + durBeats > currentBeatsPerBar + 0.01) break;

      const noteEfx = getNoteEffects(group[0]);
      const beatEfx = getBeatEffects(group[0], song.chordTemplates);
      const durStr = formatDuration(dur);
      const allBeatEfx = combineBeatEffects(dur, beatEfx);

      const formatNote = (n: Note): string => {
        const chord = formatChord(n, song.chordTemplates, noteEfx, numStrings);
        if (chord) return chord;
        return `${n.fret}.${numStrings - n.string}${noteEfx}`;
      };

      if (group.length === 1) {
        beatStrings.push(`${formatNote(group[0])}.${durStr}${allBeatEfx}`);
      } else {
        const chordNotes = group.map(
          (n) => `${n.fret}.${numStrings - n.string}${getNoteEffects(n)}`
        );
        beatStrings.push(`(${chordNotes.join(" ")}).${durStr}${allBeatEfx}`);
      }
      totalBeats += durBeats;

      // Insert rest if there's a gap between this note's sustain and the next note
      if (noteDurSec < maxAvailable - 0.03 && i < beatGroups.length - 1) {
        const gapSec = maxAvailable - noteDurSec;
        const restDur = quantizeDuration(gapSec, localBpm);
        const restBeats = durationToBeats(restDur);
        if (totalBeats + restBeats <= currentBeatsPerBar + 0.01) {
          const restEfx = restDur.dotted ? "{d}" : "";
          beatStrings.push(`r.${formatDuration(restDur)}${restEfx}`);
          totalBeats += restBeats;
        }
      }
    }

    // Reconcile: if under-budget, pad with a rest
    if (totalBeats < currentBeatsPerBar - 0.01 && beatStrings.length > 0) {
      const remaining = currentBeatsPerBar - totalBeats;
      const padDur = quantizeDuration((remaining * 60) / localBpm, localBpm);
      const padEfx = padDur.dotted ? "{d}" : "";
      beatStrings.push(`r.${formatDuration(padDur)}${padEfx}`);
    }

    lines.push(beatStrings.join(" ") + " |");
  }

  return lines.join("\n");
}

/**
 * Get the BPM from the SNG beat grid.
 */
export function getBPM(song: SongData): number {
  if (song.beats.length < 2) return 120;
  return Math.round(60 / (song.beats[1].time - song.beats[0].time));
}

/**
 * Generate sync data that maps audio time → alphaTab MIDI time.
 * The SNG beat grid has exact timing for every beat, which is more accurate
 * than relying on a fixed BPM (which causes cumulative drift).
 *
 * Uses per-beat local BPM for accurate MIDI time accumulation, matching
 * the tempo changes emitted in the AlphaTex output.
 */
export function generateSyncData(song: SongData): {
  bpm: number;
  restBars: number;
  /** Array of [audioTimeSec, alphaTabTimeMs] pairs, sampled every beat */
  points: [number, number][];
} {
  const bpm = getBPM(song);
  const INITIAL_BEAT_DUR_MS = 60000 / bpm;

  // Find the beat offset aligned to the first note (same logic as generateAlphaTex)
  const notes = getFullArrangementNotes(song);
  const firstNoteTime = notes.length > 0 ? notes[0].time : song.beats[0]?.time ?? 0;
  let beatOffset = 0;
  for (let i = 0; i < song.beats.length; i++) {
    if (song.beats[i].time >= firstNoteTime - 0.02) {
      beatOffset = i;
      break;
    }
  }

  // Calculate rest bars (must match generateAlphaTex logic)
  const groupStartTime = song.beats[beatOffset]?.time ?? 0;
  const barDuration = (4 * 60) / bpm;
  const restBars = Math.round(groupStartTime / barDuration);
  const restBarsMs = restBars * 4 * INITIAL_BEAT_DUR_MS;

  // Accumulate MIDI time per beat using local tempo.
  // Each beat's MIDI duration matches what alphaTab expects based on the
  // tempo markings emitted in the AlphaTex.
  const points: [number, number][] = [];
  let midiTimeMs = restBarsMs;

  for (let i = beatOffset; i < song.beats.length; i++) {
    const audioTime = song.beats[i].time;
    points.push([audioTime, midiTimeMs]);

    // Compute local beat duration for the next interval
    if (i + 1 < song.beats.length) {
      const localBeatSec = song.beats[i + 1].time - song.beats[i].time;
      const localBpm = Math.round(60 / localBeatSec);
      // MIDI time advances by the nominal beat duration at the local tempo
      midiTimeMs += 60000 / localBpm;
    }
  }

  return { bpm, restBars, points };
}
