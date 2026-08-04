'use client';

import { useState } from 'react';
import type { ScaleType } from '@/lib/musicTheory';
import ScaleChords from './ScaleChords';
import IntervalMeanings from './IntervalMeanings';
import PracticeExerciseTab from './PracticeExerciseTab';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScaleReferenceTabsProps {
  root: string;
  scaleType: ScaleType;
}

type ReferenceTab = 'chords' | 'intervals' | 'practice';

const TABS: { id: ReferenceTab; label: string }[] = [
  { id: 'chords', label: 'Chords & Progressions' },
  { id: 'intervals', label: 'Interval Meanings' },
  { id: 'practice', label: 'Practice Exercise' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Tabbed reference section shown below the fretboard, centralizing the
 * scale's chords/progressions and the general interval reference in one place.
 */
export default function ScaleReferenceTabs({ root, scaleType }: ScaleReferenceTabsProps) {
  const [activeTab, setActiveTab] = useState<ReferenceTab>('chords');

  return (
    <div className="w-full text-left">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-amber-800/30 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
              activeTab === tab.id
                ? 'text-amber-100 border-amber-500'
                : 'text-amber-200/60 border-transparent hover:text-amber-100 hover:bg-amber-950/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — Chords/Intervals stay readable width; Practice goes full width */}
      {activeTab === 'chords' ? (
        <div className="max-w-5xl">
          {scaleType === 'None' ? (
            <p className="text-amber-200/60 text-sm py-6 text-center">
              Select a scale above to see its chords and common progressions.
            </p>
          ) : (
            <ScaleChords root={root} scaleType={scaleType} />
          )}
        </div>
      ) : activeTab === 'intervals' ? (
        <div className="max-w-5xl">
          <IntervalMeanings />
        </div>
      ) : (
        <PracticeExerciseTab root={root} scaleType={scaleType} />
      )}
    </div>
  );
}
