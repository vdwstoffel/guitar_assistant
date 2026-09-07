"use client";

import { memo, useMemo } from "react";
import { Marker, JamTrackMarker } from "@/types";

interface MarkerChipsProps {
  markers: (Marker | JamTrackMarker)[];
  currentTime: number;
  formatTime: (seconds: number) => string;
  onJumpToMarker: (timestamp: number) => void;
  onEditMarker: (marker: Marker | JamTrackMarker) => void;
  onDelete: (markerId: string) => void;
  /** 'vertical' stacks them as a scrollable list for the sidebar. */
  orientation?: "horizontal" | "vertical";
}

/**
 * The numbered jump targets.
 *
 * Horizontal scrolls sideways rather than wrapping, so the bar it lives in keeps
 * a fixed height however many markers a track has. Vertical stacks them into a
 * scrollable list, which reads far better in a narrow column.
 */
const MarkerChips = memo(function MarkerChips({
  markers,
  currentTime,
  formatTime,
  onJumpToMarker,
  onEditMarker,
  onDelete,
  orientation = "horizontal",
}: MarkerChipsProps) {
  const isVertical = orientation === "vertical";
  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.timestamp - b.timestamp),
    [markers]
  );

  if (sortedMarkers.length === 0) return null;

  return (
    <div className={isVertical
      ? "flex flex-col gap-1 overflow-y-auto h-full"
      : "flex items-center gap-2 overflow-x-auto scrollbar-thin"
    }>
      {sortedMarkers.map((marker, index) => {
        const isPassed = marker.timestamp <= currentTime;
        const shortcutKey = index < 9 ? String(index + 1) : index === 9 ? "0" : null;
        return (
          <div
            key={marker.id}
            onClick={() => onJumpToMarker(marker.timestamp)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              // Enter activates (jump); Space is reserved for play/pause.
              if (e.key === "Enter") {
                e.preventDefault();
                onJumpToMarker(marker.timestamp);
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs group transition-colors cursor-pointer ${
              isVertical ? "w-full" : "shrink-0"
            } ${isPassed ? "bg-green-600" : "bg-gray-700"}`}
          >
            {shortcutKey && (
              <span className="text-gray-300 font-mono text-[10px] min-w-[14px]">[{shortcutKey}]</span>
            )}
            <span className="text-green-400 font-mono">{formatTime(marker.timestamp)}</span>
            <span className={isVertical ? "truncate" : "truncate max-w-40"}>{marker.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditMarker(marker);
              }}
              className="p-0.5 text-white hover:text-white opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
              title="Edit marker"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(marker.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
});

export default MarkerChips;
