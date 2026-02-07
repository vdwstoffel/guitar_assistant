"use client";

import { PageSyncPoint } from "@/types";

interface PageSyncEditorProps {
  pdfId: string;
  pdfName: string;
  syncPoints: PageSyncPoint[];
  syncEditMode: boolean;
  onToggleSyncEditMode: () => void;
  currentAudioTime: number;
  currentVisiblePage: number;
  onAddSyncPoint: () => void;
  onDeleteSyncPoint: (syncPointId: string) => void;
  onClearSyncPoints: () => void;
}

export default function PageSyncEditor({
  pdfName,
  syncPoints,
  syncEditMode,
  onToggleSyncEditMode,
  currentAudioTime,
  currentVisiblePage,
  onAddSyncPoint,
  onDeleteSyncPoint,
  onClearSyncPoints,
}: PageSyncEditorProps) {
  const sortedPoints = [...syncPoints].sort((a, b) => a.timeInSeconds - b.timeInSeconds);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  // Find which sync point is currently active (for highlighting)
  let activeSyncPointId: string | null = null;
  for (let i = sortedPoints.length - 1; i >= 0; i--) {
    if (currentAudioTime >= sortedPoints[i].timeInSeconds) {
      activeSyncPointId = sortedPoints[i].id;
      break;
    }
  }

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-300">
            Page Sync
            {pdfName && <span className="text-gray-500 ml-1">- {pdfName}</span>}
          </h3>
          <span className="text-xs text-gray-500">
            ({syncPoints.length} point{syncPoints.length !== 1 ? "s" : ""})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSyncEditMode}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              syncEditMode
                ? "bg-amber-500 text-black hover:bg-amber-400"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {syncEditMode ? "Done Editing" : "Edit Sync Points"}
          </button>

          {syncPoints.length > 0 && syncEditMode && (
            <button
              onClick={onClearSyncPoints}
              className="px-3 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {syncEditMode && (
        <div className="mb-2 p-2 bg-gray-900 rounded border border-amber-500/30">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="text-gray-400">
                Audio time:{" "}
                <span className="text-white font-mono text-xs">
                  {formatTime(currentAudioTime)}
                </span>
              </div>
              <div className="text-gray-400 mt-0.5">
                Current page:{" "}
                <span className="text-amber-400 font-mono text-xs">
                  Page {currentVisiblePage}
                </span>
              </div>
            </div>

            <button
              onClick={onAddSyncPoint}
              className="px-3 py-1.5 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-500 transition-colors"
            >
              Add Page Turn
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-1.5">
            Play audio, navigate to the target page, then click &quot;Add Page Turn&quot; to mark when this page should appear.
          </p>
        </div>
      )}

      {sortedPoints.length > 0 && (
        <div className="space-y-0.5 max-h-28 overflow-y-auto">
          {sortedPoints.map((point, index) => (
            <div
              key={point.id}
              className={`flex items-center justify-between py-1 px-2 rounded text-sm transition-colors ${
                activeSyncPointId === point.id
                  ? "bg-purple-900/30 border border-purple-500/30"
                  : "bg-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-500 w-5 text-xs">#{index + 1}</span>
                <span className="text-gray-300 font-mono text-xs">
                  {formatTime(point.timeInSeconds)}
                </span>
                <span className="text-gray-600">&#8594;</span>
                <span className="text-purple-400 text-xs">
                  Page {point.pageNumber}
                </span>
              </div>

              {syncEditMode && (
                <button
                  onClick={() => onDeleteSyncPoint(point.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors p-0.5"
                  title="Delete sync point"
                >
                  <svg
                    className="w-3.5 h-3.5"
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
