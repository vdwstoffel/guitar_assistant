'use client';

import type { PentatonicBoxPosition } from '@/lib/musicTheory';

interface PentatonicPositionSelectorProps {
  positions: PentatonicBoxPosition[];
  selectedPosition: number | null;
  onSelectPosition: (position: number | null) => void;
}

export default function PentatonicPositionSelector({
  positions,
  selectedPosition,
  onSelectPosition,
}: PentatonicPositionSelectorProps) {
  if (positions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-amber-200/60 text-xs font-medium">Position:</span>
      <div className="flex rounded overflow-hidden border border-amber-700/40">
        <button
          onClick={() => onSelectPosition(null)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedPosition === null
              ? 'bg-amber-600 text-white'
              : 'bg-amber-900/40 text-amber-200/80 hover:bg-amber-800/40'
          }`}
        >
          All
        </button>
        {positions.map((pos) => (
          <button
            key={pos.position}
            onClick={() => onSelectPosition(pos.position)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedPosition === pos.position
                ? 'bg-amber-600 text-white'
                : 'bg-amber-900/40 text-amber-200/80 hover:bg-amber-800/40'
            }`}
            title={pos.name}
          >
            {pos.position}
          </button>
        ))}
      </div>
    </div>
  );
}
