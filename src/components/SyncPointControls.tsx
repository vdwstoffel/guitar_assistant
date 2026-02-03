"use client";

import { TabSyncPoint } from "@/types";
import { formatSyncTime, formatBarIndex } from "@/lib/tabSync";

interface SyncPointControlsProps {
  syncPoints: TabSyncPoint[];
  syncEditMode: boolean;
  onToggleSyncEditMode: () => void;
  currentAudioTime: number;
  pendingTabTick: number | null;
  pendingBarIndex: number | null;
  onAddSyncPoint: () => void;
  onDeleteSyncPoint: (syncPointId: string) => void;
  onClearSyncPoints: () => void;
}

export default function SyncPointControls({
  syncPoints,
  syncEditMode,
  onToggleSyncEditMode,
  currentAudioTime,
  pendingTabTick,
  pendingBarIndex,
  onAddSyncPoint,
  onDeleteSyncPoint,
  onClearSyncPoints,
}: SyncPointControlsProps) {
  const sortedPoints = [...syncPoints].sort((a, b) => a.audioTime - b.audioTime);

  return (
    <div className="bg-zinc-800 border-b border-zinc-700 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-zinc-300">Tab Sync Points</h3>
          <span className="text-xs text-zinc-500">
            ({syncPoints.length} point{syncPoints.length !== 1 ? "s" : ""})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSyncEditMode}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              syncEditMode
                ? "bg-amber-500 text-black hover:bg-amber-400"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            {syncEditMode ? "Exit Sync Mode" : "Edit Sync Points"}
          </button>

          {syncPoints.length > 0 && (
            <button
              onClick={onClearSyncPoints}
              className="px-3 py-1.5 text-xs font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {syncEditMode && (
        <div className="mb-3 p-3 bg-zinc-900 rounded border border-amber-500/30">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="text-zinc-400">
                Current audio:{" "}
                <span className="text-white font-mono">
                  {formatSyncTime(currentAudioTime)}
                </span>
              </div>
              {pendingTabTick !== null && (
                <div className="text-zinc-400 mt-1">
                  Selected position:{" "}
                  <span className="text-amber-400 font-mono">
                    {formatBarIndex(pendingBarIndex)} (tick {pendingTabTick})
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={onAddSyncPoint}
              disabled={pendingTabTick === null}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                pendingTabTick !== null
                  ? "bg-purple-500 text-white hover:bg-purple-400"
                  : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              }`}
            >
              Add Sync Point
            </button>
          </div>

          <p className="text-xs text-zinc-500 mt-2">
            1. Play audio and pause at a recognizable moment
            <br />
            2. Click on the corresponding position in the tab
            <br />
            3. Click &quot;Add Sync Point&quot; to save
          </p>
        </div>
      )}

      {sortedPoints.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {sortedPoints.map((point, index) => (
            <div
              key={point.id}
              className="flex items-center justify-between py-1.5 px-2 bg-zinc-900 rounded text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 w-5">#{index + 1}</span>
                <span className="text-zinc-300 font-mono">
                  {formatSyncTime(point.audioTime)}
                </span>
                <span className="text-zinc-500">→</span>
                <span className="text-purple-400">
                  {formatBarIndex(point.barIndex)} <span className="text-zinc-500">(tick {point.tabTick})</span>
                </span>
              </div>

              <button
                onClick={() => onDeleteSyncPoint(point.id)}
                className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                title="Delete sync point"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {syncPoints.length < 2 && !syncEditMode && (
        <p className="text-xs text-amber-500/80 mt-2">
          Add at least 2 sync points to enable cursor following during playback.
        </p>
      )}
    </div>
  );
}
