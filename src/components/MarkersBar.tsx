"use client";

import { useEffect, useState, useRef, useCallback, memo, useMemo } from "react";
import { Marker, JamTrackMarker } from "@/types";
import { createTapTempo } from "@/lib/tapTempo";
import MarkerNameDialog from "./MarkerNameDialog";

interface MarkersBarProps {
  markers: (Marker | JamTrackMarker)[];
  visible: boolean;
  leadIn: number;
  editingMarkerId: string | null;
  editingMarkerName: string;
  currentTime: number;
  onLeadInChange: (value: number) => void;
  onAddMarker: (name: string, timestamp: number) => void;
  onJumpToMarker: (timestamp: number) => void;
  onStartEdit: (markerId: string, name: string) => void;
  onEditNameChange: (value: string) => void;
  onSaveEdit: (markerId: string, name: string) => void;
  onCancelEdit: () => void;
  onDelete: (markerId: string) => void;
  onClearAll: () => void;
  formatTime: (seconds: number) => string;
  // Count-in and tempo props
  isCountingIn?: boolean;
  currentCountInBeat?: number;
  totalCountInBeats?: number;
  trackTempo?: number | null;
  trackTimeSignature?: string;
  onTempoChange?: (tempo: number | null, timeSignature: string) => void;
}

const MarkersBar = memo(function MarkersBar({
  markers,
  visible,
  leadIn,
  editingMarkerId,
  editingMarkerName,
  currentTime,
  onLeadInChange,
  onAddMarker,
  onJumpToMarker,
  onStartEdit,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onClearAll,
  formatTime,
  isCountingIn = false,
  currentCountInBeat = 0,
  totalCountInBeats = 0,
  trackTempo = null,
  trackTimeSignature = "4/4",
  onTempoChange,
}: MarkersBarProps) {
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const tapTempoRef = useRef(createTapTempo());
  const [showDialog, setShowDialog] = useState(false);
  const [pendingMarkerTimestamp, setPendingMarkerTimestamp] = useState(0);

  const handleTap = useCallback(() => {
    const bpm = tapTempoRef.current.tap();
    setTapBpm(bpm);
    setTapCount(tapTempoRef.current.getTapCount());
  }, []);

  const handleSaveTempo = useCallback(() => {
    if (tapBpm && onTempoChange) {
      onTempoChange(tapBpm, trackTimeSignature);
      setTapBpm(null);
      setTapCount(0);
      tapTempoRef.current.reset();
    }
  }, [tapBpm, onTempoChange, trackTimeSignature]);

  const handleClearTempo = useCallback(() => {
    if (onTempoChange) {
      onTempoChange(null, trackTimeSignature);
    }
    setTapBpm(null);
    setTapCount(0);
    tapTempoRef.current.reset();
  }, [onTempoChange, trackTimeSignature]);

  const handleTimeSignatureChange = useCallback((newTimeSignature: string) => {
    if (onTempoChange) {
      onTempoChange(trackTempo, newTimeSignature);
    }
  }, [onTempoChange, trackTempo]);

  const handleOpenDialog = useCallback(() => {
    setPendingMarkerTimestamp(currentTime);
    setShowDialog(true);
  }, [currentTime]);

  const handleSaveMarker = useCallback((name: string) => {
    onAddMarker(name, pendingMarkerTimestamp);
    setShowDialog(false);
  }, [onAddMarker, pendingMarkerTimestamp]);

  const handleCancelDialog = useCallback(() => {
    setShowDialog(false);
  }, []);
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

  // Memoize sorted markers to avoid re-sorting on every render
  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.timestamp - b.timestamp),
    [markers]
  );

  if (!visible) return null;

  return (
    <div className="w-full border-t border-gray-700 bg-gray-800 text-white pt-2 pb-2 px-2 sm:px-4">
      {/* Controls Row - Centered */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
        {/* Count-in / Lead-in Controls */}
        {trackTempo && trackTempo > 0 ? (
          <div className="flex items-center gap-2">
            {/* Count-in indicator */}
            {isCountingIn ? (
              <div className="flex items-center gap-1 text-yellow-400 text-xs animate-pulse">
                <span className="font-bold">{currentCountInBeat}/{totalCountInBeats}</span>
              </div>
            ) : (
              <>
                <span className="text-xs text-gray-400">Count-in:</span>
                <span className="text-xs text-green-400 font-mono">{trackTempo} BPM</span>
                <select
                  value={trackTimeSignature}
                  onChange={(e) => handleTimeSignatureChange(e.target.value)}
                  className="px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs focus:outline-none focus:border-green-500"
                >
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="2/4">2/4</option>
                  <option value="6/8">6/8</option>
                </select>
                <button
                  onClick={handleClearTempo}
                  className="text-xs text-gray-500 hover:text-red-400"
                  title="Remove tempo (use seconds lead-in instead)"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ) : (
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
        )}

        {/* Tap Tempo */}
        {onTempoChange && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleTap}
              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
            >
              Tap
            </button>
            {tapBpm && (
              <>
                <span className="text-xs text-purple-400 font-mono">{tapBpm} BPM</span>
                <span className="text-xs text-gray-500">({tapCount} taps)</span>
                <button
                  onClick={handleSaveTempo}
                  className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                >
                  Save
                </button>
              </>
            )}
          </div>
        )}

        <button
          onClick={handleOpenDialog}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
        >
          Add Marker
        </button>

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
          {sortedMarkers.map((marker, index) => {
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

      <MarkerNameDialog
        isOpen={showDialog}
        timestamp={pendingMarkerTimestamp}
        formatTime={formatTime}
        onSave={handleSaveMarker}
        onCancel={handleCancelDialog}
      />
    </div>
  );
});

export default MarkersBar;
