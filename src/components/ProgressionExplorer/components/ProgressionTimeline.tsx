import type { ProgressionChordEntry } from '../types';

interface ProgressionTimelineProps {
  progression: ProgressionChordEntry[];
  activeChordIndex: number | null;
  onRemoveChordAt: (index: number) => void;
  onClear: () => void;
}

export default function ProgressionTimeline({
  progression,
  activeChordIndex,
  onRemoveChordAt,
  onClear,
}: ProgressionTimelineProps) {
  if (progression.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {progression.map((chord, i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 && (
            <svg className="w-4 h-4 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5l7 7-7 7" />
            </svg>
          )}
          <button
            onClick={() => onRemoveChordAt(i)}
            title="Click to remove"
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeChordIndex === i
                ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/30'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            {chord.name}
          </button>
        </div>
      ))}

      {progression.length > 0 && (
        <button
          onClick={onClear}
          title="Clear all"
          className="ml-2 p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
