import { useState, useCallback, useMemo } from 'react';
import {
  STANDARD_TUNING_INDICES,
  getNoteAtFret,
  getNoteName,
} from '@/lib/musicTheory';
import { playInterval as playIntervalAudio } from '@/lib/audioGenerator';
import type { FretPosition, IntervalInfo } from '../types';
import { INTERVAL_REFERENCE } from '../types';

const NUM_STRINGS = 6;
const NUM_FRETS = 15;

/** Default root: 6th string, 3rd fret = G */
const DEFAULT_ROOT: FretPosition = { string: 0, fret: 3 };

/**
 * Octave calculation using absolute MIDI-like approach.
 * Each string's open note has a known absolute pitch. Adding frets raises by semitones.
 */
function getOctaveForPosition(stringIndex: number, fret: number): number {
  // Absolute semitone index from C0 for each open string in standard tuning
  // E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
  const openAbsolute = [40, 45, 50, 55, 59, 64];
  const absolute = openAbsolute[stringIndex] + fret;
  return Math.floor(absolute / 12) - 1; // MIDI convention: C4 = 60, octave = floor(60/12)-1 = 4
}

export interface IntervalExplorerState {
  selectedRoot: FretPosition;
  selectedTarget: FretPosition | null;
  selectedIntervalFromPanel: number | null;
  showAllOccurrences: boolean;
  rootNoteName: string;
  targetNoteName: string | null;
  intervalSemitones: number | null;
  intervalInfo: IntervalInfo | null;
  allOccurrences: FretPosition[];
}

export interface IntervalExplorerActions {
  handleFretClick: (stringIndex: number, fret: number) => void;
  handlePanelIntervalClick: (semitones: number) => void;
  toggleShowAllOccurrences: () => void;
  resetSelection: () => void;
}

export function useIntervalExplorer(): IntervalExplorerState & IntervalExplorerActions {
  const [selectedRoot, setSelectedRoot] = useState<FretPosition>(DEFAULT_ROOT);
  const [selectedTarget, setSelectedTarget] = useState<FretPosition | null>(null);
  const [selectedIntervalFromPanel, setSelectedIntervalFromPanel] = useState<number | null>(null);
  const [showAllOccurrences, setShowAllOccurrences] = useState(true);

  const rootNoteName = getNoteAtFret(selectedRoot.string, selectedRoot.fret);

  const targetNoteName = selectedTarget
    ? getNoteAtFret(selectedTarget.string, selectedTarget.fret)
    : null;

  /** Calculate semitone distance considering actual pitch (not just note names). */
  const intervalSemitones = useMemo(() => {
    if (selectedIntervalFromPanel !== null) return selectedIntervalFromPanel;
    if (!selectedTarget) return null;

    const openAbsolute = [40, 45, 50, 55, 59, 64];
    const rootAbsolute = openAbsolute[selectedRoot.string] + selectedRoot.fret;
    const targetAbsolute = openAbsolute[selectedTarget.string] + selectedTarget.fret;
    const diff = targetAbsolute - rootAbsolute;
    // Normalize to 0-12 range for interval naming
    const normalized = ((diff % 12) + 12) % 12;
    return normalized;
  }, [selectedRoot, selectedTarget, selectedIntervalFromPanel]);

  const intervalInfo = useMemo(() => {
    if (intervalSemitones === null) return null;
    return INTERVAL_REFERENCE.find((i) => i.semitones === intervalSemitones) ?? null;
  }, [intervalSemitones]);

  /** Find all fretboard positions that form the same interval from the root note. */
  const allOccurrences = useMemo(() => {
    if (intervalSemitones === null) return [];

    const rootNoteIndex = (STANDARD_TUNING_INDICES[selectedRoot.string] + selectedRoot.fret) % 12;
    const targetNoteIndex = (rootNoteIndex + intervalSemitones) % 12;

    const positions: FretPosition[] = [];
    for (let s = 0; s < NUM_STRINGS; s++) {
      for (let f = 0; f <= NUM_FRETS; f++) {
        const noteIndex = (STANDARD_TUNING_INDICES[s] + f) % 12;
        if (noteIndex === targetNoteIndex) {
          // Skip the currently selected target position (it's highlighted separately)
          if (
            selectedTarget &&
            s === selectedTarget.string &&
            f === selectedTarget.fret
          ) {
            continue;
          }
          positions.push({ string: s, fret: f });
        }
      }
    }
    return positions;
  }, [intervalSemitones, selectedRoot, selectedTarget]);

  const playIntervalSound = useCallback(
    (rootStr: number, rootFret: number, targetStr: number, targetFret: number) => {
      const note1 = getNoteAtFret(rootStr, rootFret);
      const note2 = getNoteAtFret(targetStr, targetFret);
      const octave1 = getOctaveForPosition(rootStr, rootFret);
      const octave2 = getOctaveForPosition(targetStr, targetFret);
      // Use the lower octave as the base for playInterval
      playIntervalAudio(note1, note2, 0.5, Math.min(octave1, octave2));
    },
    [],
  );

  const handleFretClick = useCallback(
    (stringIndex: number, fret: number) => {
      // If clicking the current root, reset everything
      if (stringIndex === selectedRoot.string && fret === selectedRoot.fret) {
        setSelectedRoot(DEFAULT_ROOT);
        setSelectedTarget(null);
        setSelectedIntervalFromPanel(null);
        return;
      }

      // If clicking the current target, deselect it
      if (
        selectedTarget &&
        stringIndex === selectedTarget.string &&
        fret === selectedTarget.fret
      ) {
        setSelectedTarget(null);
        setSelectedIntervalFromPanel(null);
        return;
      }

      // Set as target
      const newTarget: FretPosition = { string: stringIndex, fret };
      setSelectedTarget(newTarget);
      setSelectedIntervalFromPanel(null);
      playIntervalSound(selectedRoot.string, selectedRoot.fret, stringIndex, fret);
    },
    [selectedRoot, selectedTarget, playIntervalSound],
  );

  const handlePanelIntervalClick = useCallback(
    (semitones: number) => {
      // Toggle off if already selected
      if (selectedIntervalFromPanel === semitones) {
        setSelectedIntervalFromPanel(null);
        return;
      }

      setSelectedIntervalFromPanel(semitones);
      setSelectedTarget(null);

      // Play the interval from the root note
      const rootNote = getNoteAtFret(selectedRoot.string, selectedRoot.fret);
      const rootNoteIndex =
        (STANDARD_TUNING_INDICES[selectedRoot.string] + selectedRoot.fret) % 12;
      const targetNote = getNoteName(rootNoteIndex + semitones);
      const rootOctave = getOctaveForPosition(selectedRoot.string, selectedRoot.fret);
      playIntervalAudio(rootNote, targetNote, 0.5, rootOctave);
    },
    [selectedRoot, selectedIntervalFromPanel],
  );

  const toggleShowAllOccurrences = useCallback(() => {
    setShowAllOccurrences((prev) => !prev);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedRoot(DEFAULT_ROOT);
    setSelectedTarget(null);
    setSelectedIntervalFromPanel(null);
  }, []);

  return {
    selectedRoot,
    selectedTarget,
    selectedIntervalFromPanel,
    showAllOccurrences,
    rootNoteName,
    targetNoteName,
    intervalSemitones,
    intervalInfo,
    allOccurrences,
    handleFretClick,
    handlePanelIntervalClick,
    toggleShowAllOccurrences,
    resetSelection,
  };
}
