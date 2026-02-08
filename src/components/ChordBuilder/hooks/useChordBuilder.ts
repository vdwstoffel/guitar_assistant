import { useState, useCallback, useMemo } from 'react';
import {
  NOTES,
  CHORD_FORMULAS,
  SCALE_FORMULAS,
  getChordNotes,
  getNoteIndex,
  getNoteName,
  getIntervalName,
} from '@/lib/musicTheory';
import { playChord as playChordAudio } from '@/lib/audioGenerator';
import { getVoicingsForChord } from '@/lib/chordVoicings';
import type { ChordVoicing } from '@/lib/chordVoicings';
import { INTERVAL_ABBREVIATIONS, getChordSymbol } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Information about a single note in the chord (for the info panel). */
export interface ChordToneInfo {
  note: string;
  semitones: number;
  intervalName: string;
  abbreviation: string;
}

/** Information about a musical key that contains this chord. */
export interface KeyAppearance {
  key: string;
  mode: 'Major' | 'Minor';
  degree: string;
}

/** State returned by the hook for presentational components. */
export interface ChordBuilderState {
  selectedRoot: string;
  selectedType: string;
  chordSymbol: string;
  chordNotes: string[];
  chordTones: ChordToneInfo[];
  voicings: ChordVoicing[];
  currentVoicingIndex: number;
  currentVoicing: ChordVoicing | null;
  hasVoicing: boolean;
  keyAppearances: KeyAppearance[];
  relatedChords: string[];
}

/** Actions returned by the hook. */
export interface ChordBuilderActions {
  selectRoot: (root: string) => void;
  selectType: (type: string) => void;
  nextVoicing: () => void;
  prevVoicing: () => void;
  playCurrentChord: () => void;
}

// ---------------------------------------------------------------------------
// Roman numeral helpers
// ---------------------------------------------------------------------------

const MAJOR_SCALE_DEGREES = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii\u00B0'];
const MINOR_SCALE_DEGREES = ['i', 'ii\u00B0', 'III', 'iv', 'v', 'VI', 'VII'];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChordBuilder(): ChordBuilderState & ChordBuilderActions {
  const [selectedRoot, setSelectedRoot] = useState('C');
  const [selectedType, setSelectedType] = useState('Major');
  const [currentVoicingIndex, setCurrentVoicingIndex] = useState(0);

  // Derived: chord symbol (e.g. "Am7")
  const chordSymbol = useMemo(
    () => getChordSymbol(selectedRoot, selectedType),
    [selectedRoot, selectedType],
  );

  // Derived: note names in the chord
  const chordNotes = useMemo(
    () => getChordNotes(selectedRoot, selectedType),
    [selectedRoot, selectedType],
  );

  // Derived: detailed chord tone info (note, interval, abbreviation)
  const chordTones = useMemo((): ChordToneInfo[] => {
    const formula = CHORD_FORMULAS[selectedType];
    if (!formula) return [];
    return formula.map((semitones) => ({
      note: getNoteName(getNoteIndex(selectedRoot) + semitones),
      semitones,
      intervalName: semitones === 0 ? 'Root' : getIntervalName(semitones),
      abbreviation: INTERVAL_ABBREVIATIONS[semitones] ?? `${semitones}st`,
    }));
  }, [selectedRoot, selectedType]);

  // Derived: available voicings for this root + type
  const voicings = useMemo(
    () => getVoicingsForChord(selectedRoot, selectedType),
    [selectedRoot, selectedType],
  );

  const currentVoicing = voicings.length > 0
    ? voicings[currentVoicingIndex % voicings.length]
    : null;

  const hasVoicing = voicings.length > 0;

  // Derived: which musical keys contain this chord
  const keyAppearances = useMemo((): KeyAppearance[] => {
    const appearances: KeyAppearance[] = [];
    const rootIndex = getNoteIndex(selectedRoot);
    if (rootIndex === -1) return appearances;

    // Check all 12 major keys
    for (const keyNote of NOTES) {
      const keyIndex = getNoteIndex(keyNote);
      const majorIntervals = SCALE_FORMULAS['Major'].intervals;

      // Find if our chord root is a scale degree of this key
      const intervalFromKey = ((rootIndex - keyIndex) + 12) % 12;
      const degreeIndex = majorIntervals.indexOf(intervalFromKey);

      if (degreeIndex !== -1) {
        // Determine what chord quality this degree would have naturally
        const expectedType = getMajorScaleDegreeQuality(degreeIndex);
        if (expectedType === selectedType) {
          appearances.push({
            key: keyNote,
            mode: 'Major',
            degree: MAJOR_SCALE_DEGREES[degreeIndex],
          });
        }
      }
    }

    // Check all 12 minor keys
    for (const keyNote of NOTES) {
      const keyIndex = getNoteIndex(keyNote);
      const minorIntervals = SCALE_FORMULAS['Minor'].intervals;

      const intervalFromKey = ((rootIndex - keyIndex) + 12) % 12;
      const degreeIndex = minorIntervals.indexOf(intervalFromKey);

      if (degreeIndex !== -1) {
        const expectedType = getMinorScaleDegreeQuality(degreeIndex);
        if (expectedType === selectedType) {
          appearances.push({
            key: keyNote,
            mode: 'Minor',
            degree: MINOR_SCALE_DEGREES[degreeIndex],
          });
        }
      }
    }

    return appearances;
  }, [selectedRoot, selectedType]);

  // Derived: related chords (share 2+ notes)
  const relatedChords = useMemo((): string[] => {
    if (chordNotes.length === 0) return [];
    const related: string[] = [];

    for (const root of NOTES) {
      for (const type of Object.keys(CHORD_FORMULAS)) {
        if (root === selectedRoot && type === selectedType) continue;
        const otherNotes = getChordNotes(root, type);
        const shared = chordNotes.filter((n) => otherNotes.includes(n));
        if (shared.length >= 2) {
          related.push(getChordSymbol(root, type));
        }
      }
    }
    // Limit to a reasonable number for display
    return related.slice(0, 12);
  }, [selectedRoot, selectedType, chordNotes]);

  // Actions
  const selectRoot = useCallback((root: string) => {
    setSelectedRoot(root);
    setCurrentVoicingIndex(0);
  }, []);

  const selectType = useCallback((type: string) => {
    setSelectedType(type);
    setCurrentVoicingIndex(0);
  }, []);

  const nextVoicing = useCallback(() => {
    setCurrentVoicingIndex((prev) =>
      voicings.length > 0 ? (prev + 1) % voicings.length : 0,
    );
  }, [voicings.length]);

  const prevVoicing = useCallback(() => {
    setCurrentVoicingIndex((prev) =>
      voicings.length > 0 ? (prev - 1 + voicings.length) % voicings.length : 0,
    );
  }, [voicings.length]);

  const playCurrentChord = useCallback(() => {
    if (chordNotes.length === 0) return;

    // If we have a voicing, play the actual notes from the voicing
    // (respecting muted strings). Otherwise, play the theoretical notes.
    if (currentVoicing) {
      const voicingNotes = getVoicingNoteNames(currentVoicing);
      if (voicingNotes.length > 0) {
        playChordAudio(voicingNotes, 1.2, 0.04, 2);
        return;
      }
    }
    playChordAudio(chordNotes, 1.2, 0.04, 3);
  }, [chordNotes, currentVoicing]);

  return {
    selectedRoot,
    selectedType,
    chordSymbol,
    chordNotes,
    chordTones,
    voicings,
    currentVoicingIndex,
    currentVoicing,
    hasVoicing,
    keyAppearances,
    relatedChords,
    selectRoot,
    selectType,
    nextVoicing,
    prevVoicing,
    playCurrentChord,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Get the note names produced by a specific voicing (skipping muted strings). */
function getVoicingNoteNames(voicing: ChordVoicing): string[] {
  // Standard tuning open note indices: E(4), A(9), D(2), G(7), B(11), E(4)
  const tuningIndices = [4, 9, 2, 7, 11, 4];
  const notes: string[] = [];

  for (let i = 0; i < 6; i++) {
    const fret = voicing.frets[i];
    if (fret === null) continue;
    notes.push(getNoteName(tuningIndices[i] + fret));
  }
  return notes;
}

/** Expected chord quality for each degree of the major scale. */
function getMajorScaleDegreeQuality(degree: number): string {
  const qualities = ['Major', 'Minor', 'Minor', 'Major', 'Major', 'Minor', 'Diminished'];
  return qualities[degree] ?? '';
}

/** Expected chord quality for each degree of the natural minor scale. */
function getMinorScaleDegreeQuality(degree: number): string {
  const qualities = ['Minor', 'Diminished', 'Major', 'Minor', 'Minor', 'Major', 'Major'];
  return qualities[degree] ?? '';
}
