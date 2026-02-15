/**
 * SNG binary format parser for Rocksmith 2014.
 * Parses decrypted SNG data into structured note/chord/section data.
 *
 * Based on the SNG format documented in:
 * - psarcjs by Sandi Chakravarty (MIT)
 * - rocksmith-custom-song-toolkit
 */

// SNG is little-endian throughout

export interface Beat {
  time: number;
  measure: number;
  beat: number;
  phraseIteration: number;
  mask: number;
}

export interface Phrase {
  solo: number;
  disparity: number;
  ignore: number;
  maxDifficulty: number;
  phraseIterationLinks: number;
  name: string;
}

export interface ChordTemplate {
  mask: number;
  frets: number[]; // 6 values
  fingers: number[]; // 6 values
  notes: number[]; // 6 values
  name: string;
}

export interface BendValue {
  time: number;
  step: number;
}

export interface Note {
  mask: number;
  flags: number;
  hash: number;
  time: number;
  string: number;
  fret: number;
  anchorFret: number;
  anchorWidth: number;
  chordId: number;
  chordNotesId: number;
  phraseId: number;
  phraseIterationId: number;
  fingerPrintId: [number, number];
  nextIterNote: number;
  prevIterNote: number;
  parentPrevNote: number;
  slideTo: number;
  slideUnpitchTo: number;
  leftHand: number;
  tap: number;
  pickDirection: number;
  slap: number;
  pluck: number;
  vibrato: number;
  sustain: number;
  maxBend: number;
  bendValues: BendValue[];
}

export interface Anchor {
  startBeatTime: number;
  endBeatTime: number;
  unk3FirstNoteTime: number;
  unk4LastNoteTime: number;
  fret: number;
  width: number;
  phraseIterationId: number;
}

export interface FingerPrint {
  chordId: number;
  startTime: number;
  endTime: number;
  unk3FirstNoteTime: number;
  unk4LastNoteTime: number;
}

export interface Level {
  difficulty: number;
  anchors: Anchor[];
  notes: Note[];
  averageNotesPerIteration: number[];
  notesInIterationCount: number[];
  fingerPrintsChords: FingerPrint[];
  fingerPrintsSingle: FingerPrint[];
}

export interface Section {
  name: string;
  number: number;
  startTime: number;
  endTime: number;
  startPhraseIterationId: number;
  endPhraseIterationId: number;
  stringMask: number[];
}

export interface PhraseIteration {
  phraseId: number;
  time: number;
  endTime: number;
  difficulty: number[];
}

export interface Metadata {
  maxScore: number;
  maxNotesAndChords: number;
  maxNotesAndChordsReal: number;
  pointsPerNote: number;
  firstBeatLength: number;
  startTime: number;
  capo: number;
  lastConversionDateTime: string;
  part: number;
  songLength: number;
  tuning: number[];
  firstNoteTime: number;
  firstNoteTimeReal: number;
  maxDifficulty: number;
}

export interface SongData {
  beats: Beat[];
  phrases: Phrase[];
  chordTemplates: ChordTemplate[];
  sections: Section[];
  phraseIterations: PhraseIteration[];
  levels: Level[];
  metadata: Metadata;
}

class BinaryReader {
  private offset = 0;
  constructor(private buf: Buffer) {}

  get position() { return this.offset; }
  get remaining() { return this.buf.length - this.offset; }

  readInt8(): number { const v = this.buf.readInt8(this.offset); this.offset += 1; return v; }
  readUInt8(): number { const v = this.buf.readUInt8(this.offset); this.offset += 1; return v; }
  readInt16LE(): number { const v = this.buf.readInt16LE(this.offset); this.offset += 2; return v; }
  readUInt16LE(): number { const v = this.buf.readUInt16LE(this.offset); this.offset += 2; return v; }
  readInt32LE(): number { const v = this.buf.readInt32LE(this.offset); this.offset += 4; return v; }
  readUInt32LE(): number { const v = this.buf.readUInt32LE(this.offset); this.offset += 4; return v; }
  readFloatLE(): number { const v = this.buf.readFloatLE(this.offset); this.offset += 4; return v; }
  readDoubleLE(): number { const v = this.buf.readDoubleLE(this.offset); this.offset += 8; return v; }

  readString(length: number): string {
    const s = this.buf.subarray(this.offset, this.offset + length);
    this.offset += length;
    // Trim null bytes
    const nullIdx = s.indexOf(0);
    return s.subarray(0, nullIdx >= 0 ? nullIdx : length).toString("ascii");
  }

  skip(bytes: number): void { this.offset += bytes; }
  peekInt32LE(offsetFromCurrent = 0): number { return this.buf.readInt32LE(this.offset + offsetFromCurrent); }
}

function readBeats(r: BinaryReader): Beat[] {
  const count = r.readInt32LE();
  const beats: Beat[] = [];
  for (let i = 0; i < count; i++) {
    beats.push({
      time: r.readFloatLE(),
      measure: r.readUInt16LE(),
      beat: r.readUInt16LE(),
      phraseIteration: r.readInt32LE(),
      mask: r.readInt32LE(),
    });
  }
  return beats;
}

function readPhrases(r: BinaryReader): Phrase[] {
  const count = r.readInt32LE();
  const phrases: Phrase[] = [];
  for (let i = 0; i < count; i++) {
    phrases.push({
      solo: r.readUInt8(),
      disparity: r.readUInt8(),
      ignore: r.readUInt8(),
      maxDifficulty: (r.skip(1), r.readInt32LE()), // skip padding byte, then read maxDiff
      phraseIterationLinks: r.readInt32LE(),
      name: r.readString(32),
    });
  }
  return phrases;
}

function readChordTemplates(r: BinaryReader): ChordTemplate[] {
  const count = r.readInt32LE();
  const templates: ChordTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const mask = r.readUInt32LE();
    const frets = [r.readUInt8(), r.readUInt8(), r.readUInt8(), r.readUInt8(), r.readUInt8(), r.readUInt8()];
    const fingers = [r.readUInt8(), r.readUInt8(), r.readUInt8(), r.readUInt8(), r.readUInt8(), r.readUInt8()];
    const notes = [r.readInt32LE(), r.readInt32LE(), r.readInt32LE(), r.readInt32LE(), r.readInt32LE(), r.readInt32LE()];
    const name = r.readString(32);
    templates.push({ mask, frets, fingers, notes, name });
  }
  return templates;
}

function readBendValues(r: BinaryReader): BendValue[] {
  const count = r.readInt32LE();
  const values: BendValue[] = [];
  for (let i = 0; i < count; i++) {
    values.push({
      time: r.readFloatLE(),
      step: r.readFloatLE(),
    });
    r.skip(4); // int16 + byte + byte padding (4 bytes)
  }
  return values;
}

function skipChordNotes(r: BinaryReader): void {
  const count = r.readInt32LE();
  // ChordNotes have fixed-size bend arrays (32 slots per string, always allocated).
  // Structure per chord note:
  //   noteMask: uint32[6] = 24 bytes
  //   per string (x6): bendCount(int32=4) + bendValues[32](12 bytes each) = 388 bytes
  //   slideTo: int8[6] = 6 bytes
  //   slideUnpitchTo: int8[6] = 6 bytes
  //   vibrato: int16[6] = 12 bytes
  // Total: 24 + 6*388 + 6 + 6 + 12 = 2376 bytes per chord note
  const CHORD_NOTE_SIZE = 2376;
  r.skip(count * CHORD_NOTE_SIZE);
}

function skipVocals(r: BinaryReader): number {
  const count = r.readInt32LE();
  for (let i = 0; i < count; i++) {
    r.skip(4 + 4 + 4 + 48); // time + note + length + lyric[48]
  }
  return count;
}

function skipSymbols(r: BinaryReader, vocalCount: number): void {
  // Symbols are only present when vocals > 0 (per Sng2014File.cs conditional write)
  if (vocalCount > 0) {
    // Symbol headers (32 bytes each: 8 x int32)
    const headerCount = r.readInt32LE();
    r.skip(headerCount * 32);
    // Textures (144 bytes each: font[128] + fontPathLength + unk + width + height)
    const textureCount = r.readInt32LE();
    r.skip(textureCount * 144);
    // Definitions (44 bytes each: text[12] + outerRect[16] + innerRect[16])
    const defCount = r.readInt32LE();
    r.skip(defCount * 44);
  }
}

function readPhraseIterations(r: BinaryReader): PhraseIteration[] {
  const count = r.readInt32LE();
  const iters: PhraseIteration[] = [];
  for (let i = 0; i < count; i++) {
    iters.push({
      phraseId: r.readInt32LE(),
      time: r.readFloatLE(),
      endTime: r.readFloatLE(),
      difficulty: [r.readInt32LE(), r.readInt32LE(), r.readInt32LE()],
    });
  }
  return iters;
}

function skipPhraseExtraInfos(r: BinaryReader): void {
  const count = r.readInt32LE();
  for (let i = 0; i < count; i++) {
    r.skip(4 + 4 + 4 + 4 + 4); // phraseId + difficulty + empty + padding + levelJump
  }
}

function skipLinkedDiffs(r: BinaryReader): void {
  const count = r.readInt32LE();
  for (let i = 0; i < count; i++) {
    r.skip(4); // parentId
    const nldPhraseCount = r.readInt32LE();
    r.skip(nldPhraseCount * 4); // phraseIds
  }
}

function skipActions(r: BinaryReader): void {
  const count = r.readInt32LE();
  for (let i = 0; i < count; i++) {
    r.skip(4 + 256); // time + actionName[256]
  }
}

function skipEvents(r: BinaryReader): void {
  const count = r.readInt32LE();
  for (let i = 0; i < count; i++) {
    r.skip(4 + 256); // time + eventName[256]
  }
}

function skipTones(r: BinaryReader): void {
  const count = r.readInt32LE();
  for (let i = 0; i < count; i++) {
    r.skip(4 + 4); // time + toneId
  }
}

function skipDNA(r: BinaryReader): void {
  const count = r.readInt32LE();
  for (let i = 0; i < count; i++) {
    r.skip(4 + 4); // time + id
  }
}

function readSections(r: BinaryReader): Section[] {
  const count = r.readInt32LE();
  const sections: Section[] = [];
  for (let i = 0; i < count; i++) {
    const name = r.readString(32);
    const number = r.readInt32LE();
    const startTime = r.readFloatLE();
    const endTime = r.readFloatLE();
    const startPhraseIterationId = r.readInt32LE();
    const endPhraseIterationId = r.readInt32LE();
    const stringMask: number[] = [];
    for (let s = 0; s < 36; s++) {
      stringMask.push(r.readUInt8());
    }
    sections.push({ name, number, startTime, endTime, startPhraseIterationId, endPhraseIterationId, stringMask });
  }
  return sections;
}

function readNote(r: BinaryReader): Note {
  const mask = r.readUInt32LE();
  const flags = r.readUInt32LE();
  const hash = r.readUInt32LE();
  const time = r.readFloatLE();
  const string = r.readUInt8();
  const fret = r.readUInt8();
  const anchorFret = r.readUInt8();
  const anchorWidth = r.readUInt8();
  const chordId = r.readInt32LE();
  const chordNotesId = r.readInt32LE();
  const phraseId = r.readInt32LE();
  const phraseIterationId = r.readInt32LE();
  const fingerPrintId: [number, number] = [r.readInt16LE(), r.readInt16LE()];
  const nextIterNote = r.readInt16LE();
  const prevIterNote = r.readInt16LE();
  const parentPrevNote = r.readInt16LE();
  const slideTo = r.readInt8();
  const slideUnpitchTo = r.readInt8();
  const leftHand = r.readInt8();
  const tap = r.readInt8();
  const pickDirection = r.readInt8();
  const slap = r.readInt8();
  const pluck = r.readInt8();
  const vibrato = r.readInt16LE();
  const sustain = r.readFloatLE();
  const maxBend = r.readFloatLE();
  const bendValues = readBendValues(r);

  return {
    mask, flags, hash, time, string, fret, anchorFret, anchorWidth,
    chordId, chordNotesId, phraseId, phraseIterationId,
    fingerPrintId, nextIterNote, prevIterNote, parentPrevNote,
    slideTo, slideUnpitchTo, leftHand, tap, pickDirection, slap, pluck,
    vibrato, sustain, maxBend, bendValues,
  };
}

function readAnchor(r: BinaryReader): Anchor {
  return {
    startBeatTime: r.readFloatLE(),
    endBeatTime: r.readFloatLE(),
    unk3FirstNoteTime: r.readFloatLE(),
    unk4LastNoteTime: r.readFloatLE(),
    fret: r.readInt32LE(),
    width: r.readInt32LE(),
    phraseIterationId: r.readInt32LE(),
  };
}

function readFingerPrint(r: BinaryReader): FingerPrint {
  return {
    chordId: r.readInt32LE(),
    startTime: r.readFloatLE(),
    endTime: r.readFloatLE(),
    unk3FirstNoteTime: r.readFloatLE(),
    unk4LastNoteTime: r.readFloatLE(),
  };
}

function readLevels(r: BinaryReader): Level[] {
  const count = r.readInt32LE();
  const levels: Level[] = [];
  for (let i = 0; i < count; i++) {
    const difficulty = r.readInt32LE();

    const anchorCount = r.readInt32LE();
    const anchors: Anchor[] = [];
    for (let a = 0; a < anchorCount; a++) {
      anchors.push(readAnchor(r));
    }

    // Anchor extensions (12 bytes each: float beatTime + byte fretId + int32 unk + int16 unk + byte unk)
    const anchorExtCount = r.readInt32LE();
    r.skip(anchorExtCount * 12);

    // Fingerprints - chords
    const fpChordCount = r.readInt32LE();
    const fingerPrintsChords: FingerPrint[] = [];
    for (let f = 0; f < fpChordCount; f++) {
      fingerPrintsChords.push(readFingerPrint(r));
    }

    // Fingerprints - single notes
    const fpSingleCount = r.readInt32LE();
    const fingerPrintsSingle: FingerPrint[] = [];
    for (let f = 0; f < fpSingleCount; f++) {
      fingerPrintsSingle.push(readFingerPrint(r));
    }

    // Notes
    const noteCount = r.readInt32LE();
    const notes: Note[] = [];
    for (let n = 0; n < noteCount; n++) {
      notes.push(readNote(r));
    }

    // Average notes per iteration
    const avgCount = r.readInt32LE();
    const averageNotesPerIteration: number[] = [];
    for (let a = 0; a < avgCount; a++) {
      averageNotesPerIteration.push(r.readFloatLE());
    }

    // Notes in iteration count (two separate arrays)
    const nic1Count = r.readInt32LE();
    const notesInIterationCount: number[] = [];
    for (let n = 0; n < nic1Count; n++) {
      notesInIterationCount.push(r.readInt32LE());
    }
    // Second notes in iteration array (all notes including ignored)
    const nic2Count = r.readInt32LE();
    r.skip(nic2Count * 4);

    levels.push({
      difficulty,
      anchors,
      notes,
      averageNotesPerIteration,
      notesInIterationCount,
      fingerPrintsChords,
      fingerPrintsSingle,
    });
  }
  return levels;
}

function readMetadata(r: BinaryReader): Metadata {
  const maxScore = r.readDoubleLE();
  const maxNotesAndChords = r.readDoubleLE();
  const maxNotesAndChordsReal = r.readDoubleLE();
  const pointsPerNote = r.readDoubleLE();
  const firstBeatLength = r.readFloatLE();
  const startTime = r.readFloatLE();
  const capo = r.readUInt8();
  const lastConversionDateTime = r.readString(32);
  const part = r.readInt16LE();
  const songLength = r.readFloatLE();
  const tuningCount = r.readInt32LE();
  const tuning: number[] = [];
  for (let i = 0; i < tuningCount; i++) {
    tuning.push(r.readInt16LE());
  }
  const firstNoteTime = r.readFloatLE();
  const firstNoteTimeReal = r.readFloatLE();
  const maxDifficulty = r.readInt32LE();

  return {
    maxScore, maxNotesAndChords, maxNotesAndChordsReal, pointsPerNote,
    firstBeatLength, startTime, capo, lastConversionDateTime, part,
    songLength, tuning, firstNoteTime, firstNoteTimeReal, maxDifficulty,
  };
}

/**
 * Parse decrypted SNG binary data into structured song data.
 * Only extracts beats, phrases, chord templates, sections, phrase iterations,
 * levels (notes), and metadata. Skips vocals, symbols, and other non-essential data.
 */
export function parseSNG(data: Buffer): SongData {
  const r = new BinaryReader(data);

  const beats = readBeats(r);
  const phrases = readPhrases(r);
  const chordTemplates = readChordTemplates(r);
  skipChordNotes(r); // Complex, skip for now
  const vocalCount = skipVocals(r);
  skipSymbols(r, vocalCount);
  const phraseIterations = readPhraseIterations(r);
  skipPhraseExtraInfos(r);
  skipLinkedDiffs(r);
  skipActions(r);
  skipEvents(r);
  skipTones(r);
  skipDNA(r);
  const sections = readSections(r);
  const levels = readLevels(r);
  const metadata = readMetadata(r);

  return { beats, phrases, chordTemplates, sections, phraseIterations, levels, metadata };
}

/**
 * Get the highest difficulty level (contains all notes)
 */
export function getMaxDifficultyLevel(song: SongData): Level | null {
  if (song.levels.length === 0) return null;
  return song.levels.reduce((max, level) =>
    level.difficulty > max.difficulty ? level : max
  );
}
