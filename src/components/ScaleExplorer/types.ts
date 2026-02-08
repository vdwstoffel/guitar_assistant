import type { ScaleType, DegreeColorClass } from '@/lib/musicTheory';

/** Which label to display on fretboard note dots. */
export type LabelMode = 'notes' | 'intervals' | 'degrees';

/** State and derived data for all fretboard enhancement features. */
export interface FretboardEnhancementsState {
  // --- Toggles and selections ---
  showDegreeColors: boolean;
  labelMode: LabelMode;
  selectedPosition: number | null; // null = "All" positions
  compareScale: ScaleType | null;

  // --- Actions ---
  toggleDegreeColors: () => void;
  setLabelMode: (mode: LabelMode) => void;
  setSelectedPosition: (pos: number | null) => void;
  setCompareScale: (scale: ScaleType | null) => void;
}

/** Classification of a note's membership when comparing two scales. */
export type ComparisonClass = 'both' | 'primary-only' | 'compare-only' | 'none';

/**
 * Fully computed display data for a single note on the fretboard.
 * Pre-calculated by the hook so presentational components stay pure.
 */
export interface NoteDisplayInfo {
  noteName: string;
  inScale: boolean;
  isRoot: boolean;
  label: string;
  degreeColorClass: DegreeColorClass;
  comparisonClass: ComparisonClass;
  inSelectedBox: boolean;
}
