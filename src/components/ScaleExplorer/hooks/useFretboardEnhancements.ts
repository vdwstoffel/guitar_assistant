import { useState, useMemo, useCallback } from 'react';
import {
  SCALE_FORMULAS,
  getNoteAtFret,
  isNoteInScale as isNoteInScaleShared,
  isRootNote as isRootNoteShared,
  getInterval,
  getScaleIntervalFormula,
  getDegreeColorClass,
  INTERVAL_ABBREVIATIONS,
  DEGREE_LABELS,
  MINOR_PENTATONIC_POSITIONS,
  MAJOR_PENTATONIC_POSITIONS,
  isInPentatonicBox,
} from '@/lib/musicTheory';
import type { ScaleType, PentatonicBoxPosition } from '@/lib/musicTheory';
import type { LabelMode, NoteDisplayInfo, ComparisonClass, FretboardEnhancementsState } from '../types';

interface UseFretboardEnhancementsParams {
  selectedKey: string;
  selectedScale: ScaleType;
}

interface UseFretboardEnhancementsReturn extends FretboardEnhancementsState {
  /** Get the pre-computed display info for a note at a given position. */
  getNoteDisplayInfo: (stringIndex: number, fret: number) => NoteDisplayInfo;
  /** The interval formula for the current scale (e.g. ["R", "m3", "P4", "P5", "m7"]). */
  scaleFormula: string[];
  /** Whether the current scale has pentatonic box positions available. */
  hasPentatonicPositions: boolean;
  /** The pentatonic box positions for the current scale, if applicable. */
  pentatonicPositions: PentatonicBoxPosition[];
  /** Whether comparison mode is active. */
  isComparing: boolean;
}

export function useFretboardEnhancements({
  selectedKey,
  selectedScale,
}: UseFretboardEnhancementsParams): UseFretboardEnhancementsReturn {
  const [showDegreeColors, setShowDegreeColors] = useState(false);
  const [labelMode, setLabelMode] = useState<LabelMode>('notes');
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [compareScale, setCompareScale] = useState<ScaleType | null>(null);

  const toggleDegreeColors = useCallback(() => setShowDegreeColors((v) => !v), []);

  // Derive the interval formula string for display
  const scaleFormula = useMemo(
    () => getScaleIntervalFormula(selectedScale),
    [selectedScale],
  );

  // Determine if pentatonic positions are available
  const pentatonicPositions = useMemo((): PentatonicBoxPosition[] => {
    if (selectedScale === 'Minor Pentatonic') return MINOR_PENTATONIC_POSITIONS;
    if (selectedScale === 'Major Pentatonic') return MAJOR_PENTATONIC_POSITIONS;
    return [];
  }, [selectedScale]);

  const hasPentatonicPositions = pentatonicPositions.length > 0;

  // Reset position selection when switching away from pentatonic scales
  const effectivePosition = hasPentatonicPositions ? selectedPosition : null;

  const isComparing = compareScale !== null && selectedScale !== 'None';

  // Build a lookup set for the comparison scale notes
  const compareScaleIntervals = useMemo(() => {
    if (!compareScale || compareScale === 'None') return null;
    const formula = SCALE_FORMULAS[compareScale];
    if (!formula || formula.intervals.length === 0) return null;
    return new Set(formula.intervals);
  }, [compareScale]);

  // Active box position data (or null for "All")
  const activeBox = useMemo(() => {
    if (effectivePosition === null || !hasPentatonicPositions) return null;
    return pentatonicPositions.find((p) => p.position === effectivePosition) ?? null;
  }, [effectivePosition, hasPentatonicPositions, pentatonicPositions]);

  // Memoized factory for NoteDisplayInfo
  const getNoteDisplayInfo = useCallback(
    (stringIndex: number, fret: number): NoteDisplayInfo => {
      const noteName = getNoteAtFret(stringIndex, fret);
      const inPrimaryScale = isNoteInScaleShared(noteName, selectedKey, selectedScale);
      const isRoot = selectedScale !== 'None' && isRootNoteShared(noteName, selectedKey);

      // Compute comparison class
      let comparisonClass: ComparisonClass = 'none';
      if (isComparing && compareScaleIntervals) {
        const semitones = getInterval(selectedKey, noteName);
        const inCompare = compareScaleIntervals.has(semitones);
        if (inPrimaryScale && inCompare) comparisonClass = 'both';
        else if (inPrimaryScale) comparisonClass = 'primary-only';
        else if (inCompare) comparisonClass = 'compare-only';
        else comparisonClass = 'none';
      }

      // For comparison mode, "inScale" means visible (in either scale)
      const inScale = isComparing
        ? comparisonClass !== 'none'
        : inPrimaryScale;

      // Determine label text
      let label = noteName;
      if (selectedScale !== 'None' && inScale) {
        const semitones = getInterval(selectedKey, noteName);
        if (labelMode === 'intervals') {
          label = INTERVAL_ABBREVIATIONS[semitones] ?? noteName;
        } else if (labelMode === 'degrees') {
          label = DEGREE_LABELS[semitones] ?? noteName;
        }
      }

      // Degree color classification
      const degreeColorClass = getDegreeColorClass(noteName, selectedKey, selectedScale);

      // Pentatonic box filtering
      let inSelectedBox = true;
      if (activeBox && inScale) {
        inSelectedBox = isInPentatonicBox(stringIndex, fret, selectedKey, activeBox);
      }

      return {
        noteName,
        inScale,
        isRoot,
        label,
        degreeColorClass,
        comparisonClass,
        inSelectedBox,
      };
    },
    [selectedKey, selectedScale, labelMode, isComparing, compareScaleIntervals, activeBox],
  );

  return {
    showDegreeColors,
    labelMode,
    selectedPosition: effectivePosition,
    compareScale,
    toggleDegreeColors,
    setLabelMode,
    setSelectedPosition,
    setCompareScale: setCompareScale as (scale: ScaleType | null) => void,
    getNoteDisplayInfo,
    scaleFormula,
    hasPentatonicPositions,
    pentatonicPositions,
    isComparing,
  };
}
