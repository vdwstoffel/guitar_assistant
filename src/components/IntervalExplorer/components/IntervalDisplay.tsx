import type { IntervalInfo } from '../types';

interface IntervalDisplayProps {
  rootNoteName: string;
  targetNoteName: string | null;
  intervalInfo: IntervalInfo | null;
  intervalSemitones: number | null;
  showAllOccurrences: boolean;
  onToggleOccurrences: () => void;
  onReset: () => void;
}

/** Color for interval quality badges. */
function qualityColor(quality: IntervalInfo['quality']): string {
  switch (quality) {
    case 'perfect':
      return 'bg-purple-600/30 text-purple-300 border-purple-500/40';
    case 'major':
      return 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40';
    case 'minor':
      return 'bg-blue-600/30 text-blue-300 border-blue-500/40';
    case 'tritone':
      return 'bg-red-600/30 text-red-300 border-red-500/40';
  }
}

export default function IntervalDisplay({
  rootNoteName,
  targetNoteName,
  intervalInfo,
  intervalSemitones,
  showAllOccurrences,
  onToggleOccurrences,
  onReset,
}: IntervalDisplayProps) {
  const hasInterval = intervalInfo !== null && intervalSemitones !== null;

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 bg-gray-800/60 rounded-lg border border-gray-700/50">
      {/* Left: interval info */}
      <div className="flex items-center gap-6">
        {/* Note arrow display */}
        <div className="flex items-center gap-3 text-lg font-mono">
          <span
            className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            }}
          >
            {rootNoteName}
          </span>
          {hasInterval && (
            <>
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                }}
              >
                {targetNoteName ?? intervalInfo.name.charAt(0)}
              </span>
            </>
          )}
        </div>

        {/* Interval details */}
        {hasInterval ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-white">
                {intervalInfo.name}
              </span>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded border ${qualityColor(intervalInfo.quality)}`}
              >
                {intervalInfo.quality}
              </span>
              <span className="text-sm text-gray-400 font-mono">
                {intervalInfo.abbreviation}
              </span>
            </div>
            <span className="text-sm text-gray-400">
              {intervalSemitones} semitone{intervalSemitones !== 1 ? 's' : ''}
              {intervalInfo.soundDescription &&
                ` -- ${intervalInfo.soundDescription}`}
            </span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">
            Click a fret position to select a target note, or pick an interval
            from the reference panel below.
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {hasInterval && (
          <button
            onClick={onToggleOccurrences}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              showAllOccurrences
                ? 'bg-cyan-700/40 text-cyan-300 border border-cyan-600/40 hover:bg-cyan-700/60'
                : 'bg-gray-700/50 text-gray-400 border border-gray-600/40 hover:bg-gray-700/70'
            }`}
          >
            {showAllOccurrences ? 'Hide' : 'Show'} all occurrences
          </button>
        )}
        <button
          onClick={onReset}
          className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700/50 text-gray-400 border border-gray-600/40 hover:bg-gray-700/70 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
