'use client';

import { SCALE_FORMULAS } from '@/lib/musicTheory';
import type { ScaleType } from '@/lib/musicTheory';
import type { LabelMode } from '../types';

interface FretboardToolbarProps {
  selectedScale: ScaleType;
  showDegreeColors: boolean;
  labelMode: LabelMode;
  compareScale: ScaleType | null;
  onToggleDegreeColors: () => void;
  onSetLabelMode: (mode: LabelMode) => void;
  onSetCompareScale: (scale: ScaleType | null) => void;
}

const LABEL_MODES: { value: LabelMode; label: string }[] = [
  { value: 'notes', label: 'Notes' },
  { value: 'intervals', label: 'Intervals' },
  { value: 'degrees', label: 'Degrees' },
];

export default function FretboardToolbar({
  selectedScale,
  showDegreeColors,
  labelMode,
  compareScale,
  onToggleDegreeColors,
  onSetLabelMode,
  onSetCompareScale,
}: FretboardToolbarProps) {
  if (selectedScale === 'None') return null;

  const scaleKeys = Object.keys(SCALE_FORMULAS).filter(
    (s) => s !== 'None' && s !== selectedScale,
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
      {/* Degree Colors Toggle */}
      <button
        onClick={onToggleDegreeColors}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          showDegreeColors
            ? 'bg-amber-600 text-white'
            : 'bg-amber-900/40 text-amber-200/80 hover:bg-amber-800/40'
        }`}
      >
        Degree Colors
      </button>

      {/* Label Mode Selector */}
      <div className="flex rounded overflow-hidden border border-amber-700/40">
        {LABEL_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => onSetLabelMode(mode.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              labelMode === mode.value
                ? 'bg-amber-600 text-white'
                : 'bg-amber-900/40 text-amber-200/80 hover:bg-amber-800/40'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Compare Scale Selector */}
      <div className="flex items-center gap-2">
        <span className="text-amber-200/60 text-xs">Compare:</span>
        <select
          value={compareScale ?? ''}
          onChange={(e) =>
            onSetCompareScale(e.target.value ? (e.target.value as ScaleType) : null)
          }
          className="px-2 py-1.5 rounded bg-amber-900/40 text-amber-100 text-xs border border-amber-700/40 focus:outline-none focus:border-amber-500"
        >
          <option value="">None</option>
          {scaleKeys.map((scale) => (
            <option key={scale} value={scale}>
              {scale}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
