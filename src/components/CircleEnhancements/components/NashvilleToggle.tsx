'use client';

import type { NotationMode } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NashvilleToggleProps {
  /** Current notation mode. */
  mode: NotationMode;
  /** Callback when the mode changes. */
  onModeChange: (mode: NotationMode) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A toggle switch between Roman numeral and Nashville Number notation.
 *
 * Purely presentational -- the active mode is managed by the parent.
 */
export default function NashvilleToggle({ mode, onModeChange }: NashvilleToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-900/50 rounded-md p-0.5">
      <button
        onClick={() => onModeChange('roman')}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
          mode === 'roman'
            ? 'bg-gray-700 text-white'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        Roman
      </button>
      <button
        onClick={() => onModeChange('nashville')}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
          mode === 'nashville'
            ? 'bg-gray-700 text-white'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        Nashville
      </button>
    </div>
  );
}
