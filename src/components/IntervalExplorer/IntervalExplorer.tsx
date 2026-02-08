'use client';

import { useIntervalExplorer } from './hooks/useIntervalExplorer';
import IntervalFretboard from './components/IntervalFretboard';
import IntervalDisplay from './components/IntervalDisplay';
import IntervalReferencePanel from './components/IntervalReferencePanel';

/**
 * IntervalExplorer - Interactive page for learning musical intervals.
 *
 * Wires the useIntervalExplorer hook (state + logic) to three
 * presentational sub-components:
 *   - IntervalFretboard  (clickable guitar neck visualization)
 *   - IntervalDisplay    (shows the current interval info prominently)
 *   - IntervalReferencePanel (table of all 13 intervals)
 */
export default function IntervalExplorer() {
  const {
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
  } = useIntervalExplorer();

  return (
    <div
      className="flex-1 flex flex-col overflow-auto"
      style={{
        background:
          'linear-gradient(to bottom, hsl(23, 64%, 5%), hsl(23, 64%, 18%))',
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-100 mb-2">
            Interval Explorer
          </h1>
          <p className="text-amber-200/60 text-sm max-w-xl mx-auto">
            An interval is the distance between two notes, measured in
            semitones. Click the amber root note, then click anywhere else on
            the fretboard to hear and see the interval.
          </p>
        </div>

        {/* Interval info bar */}
        <IntervalDisplay
          rootNoteName={rootNoteName}
          targetNoteName={targetNoteName}
          intervalInfo={intervalInfo}
          intervalSemitones={intervalSemitones}
          showAllOccurrences={showAllOccurrences}
          onToggleOccurrences={toggleShowAllOccurrences}
          onReset={resetSelection}
        />

        {/* Fretboard */}
        <IntervalFretboard
          selectedRoot={selectedRoot}
          selectedTarget={selectedTarget}
          allOccurrences={showAllOccurrences ? allOccurrences : []}
          showAllOccurrences={showAllOccurrences}
          onFretClick={handleFretClick}
        />

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs text-amber-200/50">
          <LegendItem color="#f59e0b" label="Root note" />
          <LegendItem color="#06b6d4" label="Target note" />
          <LegendItem color="#155e75" label="Same interval (other positions)" opacity={0.7} />
        </div>

        {/* Reference panel */}
        <IntervalReferencePanel
          activeIntervalSemitones={intervalSemitones}
          selectedFromPanel={selectedIntervalFromPanel}
          onIntervalClick={handlePanelIntervalClick}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper sub-component for the legend
// ---------------------------------------------------------------------------

interface LegendItemProps {
  color: string;
  label: string;
  opacity?: number;
}

function LegendItem({ color, label, opacity = 1 }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-3 h-3 rounded-full"
        style={{ background: color, opacity }}
      />
      <span>{label}</span>
    </div>
  );
}
