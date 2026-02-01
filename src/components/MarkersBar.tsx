"use client";

import { useEffect } from "react";
import { Marker } from "@/types";

interface MarkersBarProps {
  markers: Marker[];
  visible: boolean;
  leadIn: number;
  newMarkerName: string;
  editingMarkerId: string | null;
  editingMarkerName: string;
  currentTime: number;
  onLeadInChange: (value: number) => void;
  onNewMarkerNameChange: (value: string) => void;
  onAddMarker: () => void;
  onJumpToMarker: (timestamp: number) => void;
  onStartEdit: (markerId: string, name: string) => void;
  onEditNameChange: (value: string) => void;
  onSaveEdit: (markerId: string, name: string) => void;
  onCancelEdit: () => void;
  onDelete: (markerId: string) => void;
  onClearAll: () => void;
  formatTime: (seconds: number) => string;
}

export default function MarkersBar({
  markers,
  visible,
  leadIn,
  newMarkerName,
  editingMarkerId,
  editingMarkerName,
  currentTime,
  onLeadInChange,
  onNewMarkerNameChange,
  onAddMarker,
  onJumpToMarker,
  onStartEdit,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onClearAll,
  formatTime,
}: MarkersBarProps) {
  // Keyboard shortcuts: 1-9 jump to marker 1-9, 0 jumps to marker 10
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key;
      if (key >= '0' && key <= '9') {
        // Sort markers by timestamp to get consistent ordering
        const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
        // '1' = index 0, '2' = index 1, ..., '0' = index 9 (marker 10)
        const markerIndex = key === '0' ? 9 : parseInt(key) - 1;

        if (markerIndex < sortedMarkers.length) {
          onJumpToMarker(sortedMarkers[markerIndex].timestamp);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, markers, onJumpToMarker]);

  if (!visible) return null;

  return (
    <div className="w-full border-t border-gray-700 bg-gray-800 text-white pt-2 pb-2 px-4">
      {/* Controls Row - Centered */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Lead-in:</label>
          <input
            type="number"
            min={0}
            max={30}
            value={leadIn}
            onChange={(e) => onLeadInChange(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-12 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-center focus:outline-none focus:border-green-500"
          />
          <span className="text-xs text-gray-500">sec</span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newMarkerName}
            onChange={(e) => onNewMarkerNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddMarker()}
            placeholder="Marker name"
            className="w-32 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs focus:outline-none focus:border-green-500"
          />
          <button
            onClick={onAddMarker}
            disabled={!newMarkerName.trim()}
            className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-xs"
          >
            Add
          </button>
        </div>

        {markers.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Markers List - Spread across full width and centered */}
      {markers.length > 0 && (
        <div className="flex flex-wrap justify-evenly items-center gap-2 mt-2 w-full">
          {markers
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((marker: Marker, index: number) => {
              const isPassed = marker.timestamp <= currentTime;
              // Show shortcut key: 1-9 for first 9, 0 for 10th
              const shortcutKey = index < 9 ? String(index + 1) : index === 9 ? '0' : null;
              return (
              <div
                key={marker.id}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs group transition-colors ${
                  isPassed ? "bg-green-600" : "bg-gray-700"
                }`}
              >
                {shortcutKey && (
                  <span className="text-gray-500 font-mono text-[10px] min-w-[14px]">[{shortcutKey}]</span>
                )}
                <button
                  onClick={() => onJumpToMarker(marker.timestamp)}
                  className="text-green-400 font-mono"
                >
                  {formatTime(marker.timestamp)}
                </button>
                {editingMarkerId === marker.id ? (
                  <input
                    type="text"
                    value={editingMarkerName}
                    onChange={(e) => onEditNameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editingMarkerName.trim()) {
                        onSaveEdit(marker.id, editingMarkerName.trim());
                      } else if (e.key === "Escape") {
                        onCancelEdit();
                      }
                    }}
                    onBlur={onCancelEdit}
                    autoFocus
                    className="w-20 px-1 bg-gray-600 rounded text-xs"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => onJumpToMarker(marker.timestamp)}
                    >
                      {marker.name}
                    </button>
                    <button
                      onClick={() => onStartEdit(marker.id, marker.name)}
                      className="p-0.5 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit marker name"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </>
                )}
                <button
                  onClick={() => onDelete(marker.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
