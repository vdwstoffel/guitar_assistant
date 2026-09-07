"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTapTempo } from "@/lib/tapTempo";

interface MarkerSettingsPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  leadIn: number;
  onLeadInChange: (value: number) => void;
  markerCount: number;
  onRequestAddMarker: () => void;
  onClearAll: () => void;
  isCountingIn: boolean;
  currentCountInBeat: number;
  totalCountInBeats: number;
  trackTempo: number | null;
  trackTimeSignature: string;
  onTempoChange?: (tempo: number | null, timeSignature: string) => void;
  pageFlipAnticipation?: boolean;
  onPageFlipAnticipationChange?: (value: boolean) => void;
}

/**
 * Setup controls for markers — lead-in, tempo, add/clear, early flip.
 *
 * These configure a track rather than drive it, so they live behind a gear
 * instead of taking permanent space on the practice surface.
 */
export default function MarkerSettingsPopover({
  isOpen,
  onOpenChange,
  leadIn,
  onLeadInChange,
  markerCount,
  onRequestAddMarker,
  onClearAll,
  isCountingIn,
  currentCountInBeat,
  totalCountInBeats,
  trackTempo,
  trackTimeSignature,
  onTempoChange,
  pageFlipAnticipation = false,
  onPageFlipAnticipationChange,
}: MarkerSettingsPopoverProps) {
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const tapTempoRef = useRef(createTapTempo());
  const wrapperRef = useRef<HTMLDivElement>(null);

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
    onTempoChange?.(null, trackTimeSignature);
    setTapBpm(null);
    setTapCount(0);
    tapTempoRef.current.reset();
  }, [onTempoChange, trackTimeSignature]);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        onClick={() => onOpenChange(!isOpen)}
        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
          isOpen ? "bg-gray-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"
        }`}
        title="Marker settings"
        aria-expanded={isOpen}
        aria-label="Marker settings"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-64 rounded-lg bg-gray-800 border border-gray-700 shadow-xl p-3 flex flex-col gap-3 z-50">
          {/* Count-in / Lead-in */}
          {trackTempo && trackTempo > 0 ? (
            <div className="flex items-center gap-2">
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
                    onChange={(e) => onTempoChange?.(trackTempo, e.target.value)}
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

          {/* Tap tempo */}
          {onTempoChange && (
            <div className="flex items-center gap-2 flex-wrap">
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

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                onRequestAddMarker();
                onOpenChange(false);
              }}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
            >
              Add Marker
            </button>

            {markerCount > 0 && (
              <button onClick={onClearAll} className="text-xs text-red-400 hover:text-red-300">
                Clear all
              </button>
            )}
          </div>

          {onPageFlipAnticipationChange && (
            <button
              onClick={() => onPageFlipAnticipationChange(!pageFlipAnticipation)}
              className={`flex items-center justify-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                pageFlipAnticipation
                  ? "bg-blue-600/30 text-blue-400 hover:bg-blue-600/40"
                  : "bg-gray-700 text-gray-500 hover:bg-gray-600"
              }`}
              title={pageFlipAnticipation ? "Early page flip ON (1s before marker)" : "Early page flip OFF"}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Early flip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
