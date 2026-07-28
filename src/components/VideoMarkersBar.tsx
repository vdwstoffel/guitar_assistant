"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookVideoMarker } from "@/types";
import MarkerNameDialog from "./MarkerNameDialog";

interface VideoMarkersBarProps {
  markers: BookVideoMarker[];
  currentTime: number;
  onAddMarker: (name: string, timestamp: number) => void;
  onRenameMarker: (markerId: string, name: string) => void;
  onDeleteMarker: (markerId: string) => void;
  onClearAll: () => void;
  onJumpToMarker: (timestamp: number) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoMarkersBar({
  markers,
  currentTime,
  onAddMarker,
  onRenameMarker,
  onDeleteMarker,
  onClearAll,
  onJumpToMarker,
}: VideoMarkersBarProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingTimestamp, setPendingTimestamp] = useState(0);
  const [editingMarker, setEditingMarker] = useState<BookVideoMarker | null>(null);

  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.timestamp - b.timestamp),
    [markers]
  );

  // Keep the latest playhead in a ref so the keyboard shortcut can read it
  // without re-subscribing the listener on every timeupdate.
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const handleOpenAdd = useCallback(() => {
    setEditingMarker(null);
    setPendingTimestamp(currentTimeRef.current);
    setShowDialog(true);
  }, []);

  const handleOpenEdit = useCallback((marker: BookVideoMarker) => {
    setEditingMarker(marker);
    setPendingTimestamp(marker.timestamp);
    setShowDialog(true);
  }, []);

  const handleDialogSave = useCallback(
    (name: string) => {
      if (editingMarker) {
        onRenameMarker(editingMarker.id, name);
      } else {
        onAddMarker(name, pendingTimestamp);
      }
      setShowDialog(false);
      setEditingMarker(null);
    },
    [editingMarker, onRenameMarker, onAddMarker, pendingTimestamp]
  );

  const handleDialogCancel = useCallback(() => {
    setShowDialog(false);
    setEditingMarker(null);
  }, []);

  // Keyboard shortcuts: 'm' adds a marker at the playhead; number keys 1-9 jump
  // to markers 1-9, 0 jumps to marker 10.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key;
      if (key === "m" || key === "M") {
        e.preventDefault();
        handleOpenAdd();
        return;
      }
      if (key >= "0" && key <= "9") {
        const index = key === "0" ? 9 : parseInt(key) - 1;
        if (index < sortedMarkers.length) onJumpToMarker(sortedMarkers[index].timestamp);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sortedMarkers, onJumpToMarker, handleOpenAdd]);

  return (
    <div className="w-full border-t border-gray-700 bg-gray-800 text-white pt-2 pb-2 px-2 sm:px-4">
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpenAdd}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
        >
          Add Marker
        </button>
        {markers.length > 0 && (
          <button onClick={onClearAll} className="text-xs text-red-400 hover:text-red-300">
            Clear all
          </button>
        )}
      </div>

      {markers.length > 0 && (
        <div className="flex flex-wrap justify-evenly items-center gap-2 mt-2 w-full">
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
                  isPassed ? "bg-green-600" : "bg-gray-700"
                }`}
              >
                {shortcutKey && (
                  <span className="text-gray-300 font-mono text-[10px] min-w-[14px]">[{shortcutKey}]</span>
                )}
                <span className="text-green-400 font-mono">{formatTime(marker.timestamp)}</span>
                <span className="truncate">{marker.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(marker);
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
                    onDeleteMarker(marker.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300"
                  title="Delete marker"
                  aria-label="Delete marker"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <MarkerNameDialog
        isOpen={showDialog}
        timestamp={pendingTimestamp}
        formatTime={formatTime}
        onSave={handleDialogSave}
        onCancel={handleDialogCancel}
        hasPdf={false}
        initialName={editingMarker?.name}
      />
    </div>
  );
}
