"use client";

interface TrackListRailProps {
  trackName: string | null;
  onExpand: () => void;
}

/**
 * The collapsed track list: a 40px strip carrying an expand chevron and the
 * current track's name, set vertically.
 */
export default function TrackListRail({ trackName, onExpand }: TrackListRailProps) {
  return (
    <button
      onClick={onExpand}
      title="Show track list"
      aria-label="Show track list"
      className="w-10 shrink-0 h-full flex flex-col items-center gap-3 py-2 bg-gray-800 border-r border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      {trackName && (
        <span
          className="text-xs whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ writingMode: "vertical-rl" }}
        >
          {trackName}
        </span>
      )}
    </button>
  );
}
