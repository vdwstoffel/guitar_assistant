import { INTERVAL_REFERENCE } from '../types';
import type { IntervalInfo } from '../types';

interface IntervalReferencePanelProps {
  /** The semitone count of the currently active interval (from fretboard click or panel click). */
  activeIntervalSemitones: number | null;
  /** The semitone count clicked directly in the panel (for toggle highlighting). */
  selectedFromPanel: number | null;
  onIntervalClick: (semitones: number) => void;
}

/** Color for the quality badge based on interval type. */
function qualityBadgeClass(quality: IntervalInfo['quality']): string {
  switch (quality) {
    case 'perfect':
      return 'bg-purple-900/40 text-purple-300';
    case 'major':
      return 'bg-emerald-900/40 text-emerald-300';
    case 'minor':
      return 'bg-blue-900/40 text-blue-300';
    case 'tritone':
      return 'bg-red-900/40 text-red-300';
  }
}

export default function IntervalReferencePanel({
  activeIntervalSemitones,
  selectedFromPanel,
  onIntervalClick,
}: IntervalReferencePanelProps) {
  return (
    <div className="bg-gray-800/40 rounded-lg border border-gray-700/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Interval Reference
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Click any interval to highlight all its positions on the fretboard
        </p>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[3fr_1fr_1fr_1fr_3fr_4fr] gap-px bg-gray-700/30 px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        <span>Interval</span>
        <span className="text-center">Abbr</span>
        <span className="text-center">Semi</span>
        <span className="text-center">Quality</span>
        <span>Sound</span>
        <span>Song Example</span>
      </div>

      {/* Interval rows */}
      <div className="divide-y divide-gray-700/30">
        {INTERVAL_REFERENCE.map((interval) => (
          <IntervalRow
            key={interval.semitones}
            interval={interval}
            isActive={activeIntervalSemitones === interval.semitones}
            isSelectedFromPanel={selectedFromPanel === interval.semitones}
            onClick={() => onIntervalClick(interval.semitones)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row sub-component
// ---------------------------------------------------------------------------

interface IntervalRowProps {
  interval: IntervalInfo;
  isActive: boolean;
  isSelectedFromPanel: boolean;
  onClick: () => void;
}

function IntervalRow({
  interval,
  isActive,
  isSelectedFromPanel,
  onClick,
}: IntervalRowProps) {
  const rowHighlight = isSelectedFromPanel
    ? 'bg-cyan-900/30 border-l-2 border-l-cyan-400'
    : isActive
      ? 'bg-amber-900/20 border-l-2 border-l-amber-500/60'
      : 'border-l-2 border-l-transparent hover:bg-gray-700/30';

  return (
    <button
      onClick={onClick}
      className={`grid grid-cols-[3fr_1fr_1fr_1fr_3fr_4fr] gap-px w-full px-5 py-2.5 text-left transition-colors ${rowHighlight}`}
    >
      <span
        className={`text-sm font-medium ${
          isActive || isSelectedFromPanel ? 'text-white' : 'text-gray-300'
        }`}
      >
        {interval.name}
      </span>
      <span className="text-sm text-gray-400 font-mono text-center">
        {interval.abbreviation}
      </span>
      <span className="text-sm text-gray-400 font-mono text-center">
        {interval.semitones}
      </span>
      <span className="text-center">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-xs ${qualityBadgeClass(interval.quality)}`}
        >
          {interval.quality}
        </span>
      </span>
      <span className="text-sm text-gray-400 italic">
        {interval.soundDescription}
      </span>
      <span className="text-sm text-gray-500">
        {interval.songExample || '--'}
      </span>
    </button>
  );
}
