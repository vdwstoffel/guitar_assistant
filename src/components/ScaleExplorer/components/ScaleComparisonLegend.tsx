'use client';

import type { ScaleType } from '@/lib/musicTheory';

interface ScaleComparisonLegendProps {
  primaryScale: ScaleType;
  compareScale: ScaleType | null;
  selectedKey: string;
}

export default function ScaleComparisonLegend({
  primaryScale,
  compareScale,
  selectedKey,
}: ScaleComparisonLegendProps) {
  if (!compareScale || primaryScale === 'None') return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded-full bg-amber-500 border border-amber-400" />
        <span className="text-amber-200/70 text-xs">
          Both ({selectedKey} {primaryScale} + {compareScale})
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded-full border-2 border-cyan-400 bg-transparent" />
        <span className="text-amber-200/70 text-xs">
          {primaryScale} only
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded-full border-2 border-rose-400 bg-transparent" />
        <span className="text-amber-200/70 text-xs">
          {compareScale} only
        </span>
      </div>
    </div>
  );
}
