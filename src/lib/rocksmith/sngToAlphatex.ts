/**
 * Converts parsed SNG data to AlphaTex format for rendering with alphaTab.
 *
 * AlphaTex reference: https://alphatab.net/docs/alphatex/introduction
 * SNG data comes from sngParser.ts
 */
import { SongData, Note, Beat, ChordTemplate } from "./sngParser";

// Standard tuning MIDI notes for each string (high to low): E4 B3 G3 D3 A2 E2
const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];
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

function getTuningString(tuningOffsets: number[]): string {
  // tuningOffsets: semitone offsets from standard tuning per string
  // SNG strings: 0=low E, 1=A, 2=D, 3=G, 4=B, 5=high E
  // AlphaTex tuning: high to low (string 1 = high E)
  return tuningOffsets
    .map((offset, sngString) => {
      const standardIdx = 5 - sngString; // reverse: SNG string 0 = AlphaTex string 6
      return midiToNoteName(STANDARD_TUNING[standardIdx] + offset);
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

/** Find the closest note duration for a given time in seconds at a given tempo */
function quantizeDuration(durationSec: number, bpm: number): number {
  const beatDuration = 60 / bpm; // seconds per quarter note
  const ratio = durationSec / beatDuration;

  if (ratio >= 3) return 1; // whole
  if (ratio >= 1.5) return 2; // half
  if (ratio >= 0.75) return 4; // quarter
  if (ratio >= 0.375) return 8; // eighth
  if (ratio >= 0.1875) return 16; // sixteenth
  return 32; // thirty-second
}

/** Get note-level effects (go on individual notes, before duration) */
function getNoteEffects(note: Note): string {
  const effects: string[] = [];

  // Hammer-on/pull-off: mask bit 1 = 0x2
  if (note.mask & 0x2) effects.push("h");
  // Palm mute: mask bit 9 = 0x200
  if (note.mask & 0x200) effects.push("pm");
  // Slide
  if (note.slideTo > 0) effects.push("sl");
  // Tap
  if (note.tap > 0) effects.push("t");
  // Bend
  if (note.maxBend > 0) {
    const bendQuarters = Math.round(note.maxBend * 4);
    effects.push(`b (0 ${bendQuarters} ${bendQuarters} 0)`);
  }

  if (effects.length === 0) return "";
  return `{${effects.join(" ")}}`;
}

/** Get beat-level effects (go after duration) */
function getBeatEffects(note: Note): string {
  const effects: string[] = [];

  if (note.vibrato > 0) effects.push("v");
  if (note.slap > 0) effects.push("ds");

  if (effects.length === 0) return "";
  return `{${effects.join(" ")}}`;
}

function formatChord(
  note: Note,
  chordTemplates: ChordTemplate[],
  noteEffects: string
): string | null {
  if (note.chordId < 0 || !chordTemplates[note.chordId]) return null;

  const ct = chordTemplates[note.chordId];
  const chordNotes: string[] = [];
  for (let s = 0; s < 6; s++) {
    if (ct.frets[s] !== 255) {
      // SNG string 0=lowE → AlphaTex string 6, SNG string 5=highE → AlphaTex string 1
      chordNotes.push(`${ct.frets[s]}.${6 - s}${noteEffects}`);
    }
  }
  if (chordNotes.length > 1) {
    return `(${chordNotes.join(" ")})`;
  } else if (chordNotes.length === 1) {
    return chordNotes[0];
  }
  return null;
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
  const tuning = getTuningString(song.metadata.tuning);

  // Estimate BPM from beat grid (beats are quarter notes)
  const firstBeat = song.beats[0];
  const secondBeat = song.beats[1];
  const bpm = secondBeat
    ? Math.round(60 / (secondBeat.time - firstBeat.time))
    : 120;
  const BEATS_PER_BAR = 4; // Assume 4/4 time

  const lines: string[] = [];
  lines.push(`\\title "${songTitle}"`);
  lines.push(`\\subtitle "${arrangementName}"`);
  lines.push(`\\artist "${artistName}"`);
  lines.push(`\\tempo ${bpm}`);
  lines.push(`\\ts ${BEATS_PER_BAR} 4`);
  lines.push(`\\tuning ${tuning}`);
  lines.push(`\\instrument 25`); // Steel guitar
  lines.push(`\\staff{score tabs}`);
  lines.push(`.`); // End of metadata

  // Prepend rest bars to account for silence at the start of the audio.
  // The SNG beat grid starts at firstBeat.time (seconds into the audio),
  // but alphaTab's MIDI timeline starts at 0ms. Adding rest bars aligns them.
  const barDuration = (BEATS_PER_BAR * 60) / bpm;
  const restBars = Math.round(firstBeat.time / barDuration);
  for (let i = 0; i < restBars; i++) {
    lines.push(`r.1 |`);
  }

  // Group SNG beats into musical measures (4 beats each in 4/4)
  const musicalMeasures: {
    startTime: number;
    endTime: number;
    beats: Beat[];
  }[] = [];
  for (let i = 0; i < song.beats.length; i += BEATS_PER_BAR) {
    const barBeats = song.beats.slice(i, i + BEATS_PER_BAR);
    const endTime =
      i + BEATS_PER_BAR < song.beats.length
        ? song.beats[i + BEATS_PER_BAR].time
        : barBeats[barBeats.length - 1].time + 60 / bpm;
    musicalMeasures.push({
      startTime: barBeats[0].time,
      endTime,
      beats: barBeats,
    });
  }

  // For each musical measure, generate AlphaTex
  let noteIdx = 0;
  const measureLimit =
    maxMeasures > 0
      ? Math.min(musicalMeasures.length, maxMeasures)
      : musicalMeasures.length;

  for (let mi = 0; mi < measureLimit; mi++) {
    const measure = musicalMeasures[mi];

    // Collect notes in this measure
    const measureNotes: Note[] = [];
    while (noteIdx < notes.length && notes[noteIdx].time < measure.endTime) {
      if (notes[noteIdx].time >= measure.startTime) {
        measureNotes.push(notes[noteIdx]);
      }
      noteIdx++;
    }

    if (measureNotes.length === 0) {
      lines.push(`r.1 |`);
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

    // Generate AlphaTex for each beat group
    const beatStrings: string[] = [];

    // Add leading rest if notes don't start at the beginning of the measure
    const firstNoteTime = beatGroups[0][0].time;
    const leadingGap = firstNoteTime - measure.startTime;
    if (leadingGap > 0.02) {
      const leadingDuration = quantizeDuration(leadingGap, bpm);
      beatStrings.push(`r.${leadingDuration}`);
    }

    for (let i = 0; i < beatGroups.length; i++) {
      const group = beatGroups[i];
      const nextTime = beatGroups[i + 1]?.[0]?.time ?? measure.endTime;
      const duration = nextTime - group[0].time;
      const alphaDuration = quantizeDuration(duration, bpm);

      const noteEfx = getNoteEffects(group[0]);
      const beatEfx = getBeatEffects(group[0]);

      const formatNote = (n: Note): string => {
        const chord = formatChord(n, song.chordTemplates, noteEfx);
        if (chord) return chord;
        // Single note: fret.string{noteEffects}
        return `${n.fret}.${6 - n.string}${noteEfx}`;
      };

      if (group.length === 1) {
        beatStrings.push(
          `${formatNote(group[0])}.${alphaDuration}${beatEfx}`
        );
      } else {
        // For chords, apply note effects to each note
        const chordNotes = group.map(
          (n) => `${n.fret}.${6 - n.string}${getNoteEffects(n)}`
        );
        beatStrings.push(
          `(${chordNotes.join(" ")}).${alphaDuration}${beatEfx}`
        );
      }
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
 * Returns an array of [audioTimeSeconds, alphaTabTimeMs] pairs.
 * The viewer interpolates between these to get accurate cursor positioning.
 */
export function generateSyncData(song: SongData): {
  bpm: number;
  restBars: number;
  /** Array of [audioTimeSec, alphaTabTimeMs] pairs, sampled every 4 beats (1 bar) */
  points: [number, number][];
} {
  const bpm = getBPM(song);
  const BEATS_PER_BAR = 4;
  const barDuration = (BEATS_PER_BAR * 60) / bpm;
  const firstBeatTime = song.beats[0]?.time ?? 0;
  const restBars = Math.round(firstBeatTime / barDuration);
  const restBarsMs = restBars * barDuration * 1000;
  const beatDurationMs = 60000 / bpm;

  // Sample every bar (every 4 beats) to keep the file small
  const points: [number, number][] = [];
  for (let i = 0; i < song.beats.length; i += BEATS_PER_BAR) {
    const audioTime = song.beats[i].time;
    const alphaTabTime = restBarsMs + i * beatDurationMs;
    points.push([audioTime, alphaTabTime]);
  }

  return { bpm, restBars, points };
}
