import { INTERVAL_REFERENCE } from '@/lib/intervalReference';
import type { IntervalInfo } from '@/lib/intervalReference';

// ---------------------------------------------------------------------------
// Quality badge styling
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Static reference of all 13 intervals (unison → octave) with their quality,
 * character, and a well-known song example. Read-only reference shown in the
 * Scale Practice "Interval Meanings" tab.
 */
export default function IntervalMeanings() {
  return (
    <div className="rounded-lg border border-amber-800/30 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[3fr_1fr_1fr_1.5fr_3fr_4fr] gap-px bg-amber-950/40 px-4 py-2 text-xs font-semibold text-amber-300/70 uppercase tracking-wider">
        <span>Interval</span>
        <span className="text-center">Abbr</span>
        <span className="text-center">Semi</span>
        <span className="text-center">Quality</span>
        <span>Sound</span>
        <span>Song Example</span>
      </div>

      {/* Interval rows */}
      <div className="divide-y divide-amber-800/20">
        {INTERVAL_REFERENCE.map((interval) => (
          <div
            key={interval.semitones}
            className="grid grid-cols-[3fr_1fr_1fr_1.5fr_3fr_4fr] gap-px w-full px-4 py-2.5 text-left hover:bg-amber-950/20 transition-colors"
          >
            <span className="text-sm font-medium text-amber-100">{interval.name}</span>
            <span className="text-sm text-amber-200/60 font-mono text-center">
              {interval.abbreviation}
            </span>
            <span className="text-sm text-amber-200/60 font-mono text-center">
              {interval.semitones}
            </span>
            <span className="text-center">
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-xs ${qualityBadgeClass(interval.quality)}`}
              >
                {interval.quality}
              </span>
            </span>
            <span className="text-sm text-amber-200/70 italic">
              {interval.soundDescription}
            </span>
            <span className="text-sm text-amber-200/50">
              {interval.songExample || '--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
