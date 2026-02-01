"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Song, Marker } from "@/types";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";

export interface MarkerBarState {
  showMarkers: boolean;
  setShowMarkers: (value: boolean) => void;
  newMarkerName: string;
  setNewMarkerName: (value: string) => void;
  leadIn: number;
  setLeadIn: (value: number) => void;
  editingMarkerId: string | null;
  setEditingMarkerId: (value: string | null) => void;
  editingMarkerName: string;
  setEditingMarkerName: (value: string) => void;
  currentTime: number;
  jumpToMarker: (timestamp: number) => void;
  addMarker: () => void;
  formatTime: (seconds: number) => string;
}

interface BottomPlayerProps {
  song: Song | null;
  onMarkerAdd: (songId: string, name: string, timestamp: number) => void;
  onMarkerUpdate: (markerId: string, timestamp: number) => void;
  onMarkerRename: (markerId: string, name: string) => void;
  onMarkerDelete: (markerId: string) => void;
  onMarkersClear: (songId: string) => void;
  externalMarkersBar?: boolean;
  onMarkerBarStateChange?: (state: MarkerBarState) => void;
}

export default function BottomPlayer({
  song,
  onMarkerAdd,
  onMarkerUpdate,
  onMarkerRename,
  onMarkerDelete,
  onMarkersClear,
  externalMarkersBar = false,
  onMarkerBarStateChange,
}: BottomPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const prevMarkerIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const zoomRef = useRef(1);
  const currentTimeRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(100);
  const [speedInputValue, setSpeedInputValue] = useState("");
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('globalVolume');
      return saved ? parseInt(saved, 10) : 100;
    }
    return 100;
  });
  const [showMarkers, setShowMarkers] = useState(false);
  const [newMarkerName, setNewMarkerName] = useState("");
  const [leadIn, setLeadIn] = useState(0);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarkerName, setEditingMarkerName] = useState("");
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const handleZoom = (newZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(200, newZoom));
    zoomRef.current = clampedZoom;
    setZoom(clampedZoom);
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(clampedZoom);
    }
  };

  // Mouse wheel zoom handler with cursor-focused zooming
  const handleWheelZoom = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const container = waveformContainerRef.current;
    const waveform = waveformRef.current;
    if (!container || !waveform || !wavesurferRef.current) return;

    // Get cursor position relative to container
    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;

    // Current scroll position
    const scrollLeft = container.scrollLeft;

    // Position in content that cursor is pointing at
    const cursorContentPosition = scrollLeft + cursorX;

    // Calculate new zoom level using ref to avoid stale closure
    const currentZoom = zoomRef.current;
    const zoomDelta = e.deltaY > 0 ? -5 : 5;
    const newZoom = Math.max(1, Math.min(200, currentZoom + zoomDelta));

    if (newZoom === currentZoom) return; // No change

    // Calculate zoom ratio and new positions mathematically
    const zoomRatio = newZoom / currentZoom;

    // The position under cursor scales with zoom
    const newCursorContentPosition = cursorContentPosition * zoomRatio;

    // Calculate new scroll position to keep cursor position stable
    const newScrollLeft = newCursorContentPosition - cursorX;

    // Apply the new zoom
    zoomRef.current = newZoom;
    setZoom(newZoom);
    wavesurferRef.current.zoom(newZoom);

    // Apply scroll position after WaveSurfer updates - use double rAF to ensure DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (container) {
          container.scrollLeft = Math.max(0, newScrollLeft);
          setScrollLeft(Math.max(0, newScrollLeft));
        }
      });
    });
  }, []);

  const handlePlaybackSpeed = (speed: number) => {
    const clampedSpeed = Math.max(10, Math.min(200, speed));
    setPlaybackSpeed(clampedSpeed);
    if (song) {
      localStorage.setItem(`playbackSpeed_${song.id}`, clampedSpeed.toString());
    }
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(clampedSpeed / 100, true);
    }
  };

  const handleVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, newVolume));
    setVolume(clampedVolume);
    localStorage.setItem('globalVolume', clampedVolume.toString());
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(clampedVolume / 100);
    }
  };

  const initWaveSurfer = useCallback(() => {
    if (!waveformRef.current || !song) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    setIsLoading(true);

    const regions = RegionsPlugin.create();

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#4b5563",
      progressColor: "#22c55e",
      cursorColor: "#ffffff",
      cursorWidth: 2,
      height: 140,
      normalize: true,
      minPxPerSec: 1,
      autoScroll: true,
      autoCenter: true,
      plugins: [regions],
    });

    regionsRef.current = regions;

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setIsLoading(false);

      // Apply saved playback speed for this song
      const savedSpeed = localStorage.getItem(`playbackSpeed_${song.id}`);
      const speed = savedSpeed ? parseInt(savedSpeed, 10) : 100;
      setPlaybackSpeed(speed);
      ws.setPlaybackRate(speed / 100, true);

      // Apply global volume
      const savedVolume = localStorage.getItem('globalVolume');
      const vol = savedVolume ? parseInt(savedVolume, 10) : 100;
      setVolume(vol);
      ws.setVolume(vol / 100);

      song.markers.forEach((marker) => {
        const region = regions.addRegion({
          id: marker.id,
          start: marker.timestamp,
          end: marker.timestamp,
          color: "rgba(250, 204, 21, 1)",
          resize: false,
          drag: true,
        });
        if (region.element) {
          region.element.classList.add("marker-region");
        }
      });

      prevMarkerIdsRef.current = new Set(song.markers.map((m) => m.id));
      isInitialLoadRef.current = false;

      regions.on("region-updated", (region) => {
        onMarkerUpdate(region.id, region.start);
      });
    });

    ws.on("timeupdate", (time) => {
      currentTimeRef.current = time;
      // Only update state if time changed by more than 50ms to reduce re-renders
      setCurrentTime(prevTime => Math.abs(prevTime - time) > 0.05 ? time : prevTime);
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    ws.load(`/api/audio/${encodeURIComponent(song.filePath)}`);

    wavesurferRef.current = ws;
  }, [song]);

  useEffect(() => {
    if (song) {
      prevMarkerIdsRef.current = new Set();
      isInitialLoadRef.current = true;
      initWaveSurfer();
    }

    return () => {
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch {
          // Ignore errors during cleanup (e.g., DOM already removed)
        }
        wavesurferRef.current = null;
      }
    };
  }, [song?.id]);

  // Wheel zoom event listener - re-run when song changes or loading completes
  useEffect(() => {
    const container = waveformContainerRef.current;
    if (!container || !song) return;

    container.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheelZoom);
    };
  }, [handleWheelZoom, song, isLoading]);

  // Track scroll position and container width for marker labels
  useEffect(() => {
    const container = waveformContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollLeft(container.scrollLeft);
    };

    const handleResize = () => {
      setContainerWidth(container.clientWidth);
    };

    // Initial measurement
    handleResize();

    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [song, isLoading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (wavesurferRef.current) {
          wavesurferRef.current.playPause();
        }
      }

      if (e.code === "KeyM" && song) {
        e.preventDefault();
        const markerCount = song.markers.length + 1;
        onMarkerAdd(song.id, `Marker ${markerCount}`, currentTime);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [song, currentTime, onMarkerAdd]);

  // Update markers on waveform when they change
  useEffect(() => {
    if (!regionsRef.current || !song || isLoading || isInitialLoadRef.current) return;

    const currentMarkerIds = new Set(song.markers.map((m) => m.id));
    const prevMarkerIds = prevMarkerIdsRef.current;

    const markersChanged =
      currentMarkerIds.size !== prevMarkerIds.size ||
      [...currentMarkerIds].some((id) => !prevMarkerIds.has(id)) ||
      [...prevMarkerIds].some((id) => !currentMarkerIds.has(id));

    if (!markersChanged) {
      return;
    }

    prevMarkerIdsRef.current = currentMarkerIds;

    regionsRef.current.clearRegions();
    song.markers.forEach((marker) => {
      const region = regionsRef.current?.addRegion({
        id: marker.id,
        start: marker.timestamp,
        end: marker.timestamp,
        color: "rgba(250, 204, 21, 1)",
        resize: false,
        drag: true,
      });
      if (region?.element) {
        region.element.classList.add("marker-region");
      }
    });
  }, [song?.markers, isLoading]);

  const togglePlay = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  };

  const restartFromBeginning = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.seekTo(0);
    wavesurferRef.current.play();
  };

  const jumpToMarker = useCallback((timestamp: number) => {
    if (!wavesurferRef.current || !duration) return;
    const startTime = Math.max(0, timestamp - leadIn);
    wavesurferRef.current.seekTo(startTime / duration);
    wavesurferRef.current.play();
  }, [duration, leadIn]);

  const addMarker = useCallback(() => {
    if (!song || !newMarkerName.trim()) return;
    onMarkerAdd(song.id, newMarkerName.trim(), currentTimeRef.current);
    setNewMarkerName("");
  }, [song, newMarkerName, onMarkerAdd]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Store callback in ref to avoid dependency issues
  const onMarkerBarStateChangeRef = useRef(onMarkerBarStateChange);
  onMarkerBarStateChangeRef.current = onMarkerBarStateChange;
  const stateCallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expose marker bar state to parent for external rendering (debounced)
  useEffect(() => {
    if (stateCallbackTimeoutRef.current) {
      clearTimeout(stateCallbackTimeoutRef.current);
    }

    stateCallbackTimeoutRef.current = setTimeout(() => {
      if (onMarkerBarStateChangeRef.current) {
        onMarkerBarStateChangeRef.current({
          showMarkers,
          setShowMarkers,
          newMarkerName,
          setNewMarkerName,
          leadIn,
          setLeadIn,
          editingMarkerId,
          setEditingMarkerId,
          editingMarkerName,
          setEditingMarkerName,
          currentTime,
          jumpToMarker,
          addMarker,
          formatTime,
        });
      }
    }, 16); // Debounce to ~60fps

    return () => {
      if (stateCallbackTimeoutRef.current) {
        clearTimeout(stateCallbackTimeoutRef.current);
      }
    };
  }, [showMarkers, newMarkerName, leadIn, editingMarkerId, editingMarkerName, currentTime, jumpToMarker, addMarker, formatTime]);

  if (!song) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-800 border-t border-gray-700 text-gray-500">
        <p>Select a song to play</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-800 border-t border-gray-700 text-white">
      {/* Main Player Section */}
      <div className="flex-1 flex flex-col px-4 py-2">
          {/* Controls Row - Centered */}
          <div className="flex items-center justify-center gap-6 text-xs mb-2">
            {/* Restart Button */}
            <button
              onClick={restartFromBeginning}
              disabled={isLoading}
              className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 rounded-full transition-colors flex-shrink-0"
              title="Restart from beginning"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="5" width="3" height="14" />
                <path d="M9 12l10-7v14z" />
              </svg>
            </button>

            {/* Play Button */}
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-10 h-10 flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-full transition-colors flex-shrink-0"
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time Display */}
            <span className="text-xs text-gray-400 tabular-nums w-20 text-center">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Speed */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Speed:</span>
              <input
                type="number"
                min={10}
                max={200}
                value={speedInputValue || playbackSpeed}
                onChange={(e) => setSpeedInputValue(e.target.value)}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    handlePlaybackSpeed(val);
                  }
                  setSpeedInputValue("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    if (!isNaN(val)) {
                      handlePlaybackSpeed(val);
                    }
                    setSpeedInputValue("");
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-16 px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-center focus:outline-none focus:border-green-500"
              />
              <span className="text-gray-500">%</span>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Zoom:</span>
              <input
                type="range"
                min={1}
                max={100}
                value={zoom}
                onChange={(e) => handleZoom(parseFloat(e.target.value))}
                className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <span className="text-gray-500 w-8">{Math.round(zoom)}x</span>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVolume(volume === 0 ? 100 : 0)}
                className="text-gray-400 hover:text-white"
              >
                {volume === 0 ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => handleVolume(parseInt(e.target.value))}
                className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>

            {/* Markers Toggle */}
            <button
              onClick={() => setShowMarkers(!showMarkers)}
              className={`flex items-center gap-1 px-2 py-1 rounded ${
                showMarkers ? "bg-yellow-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Markers ({song.markers.length})
            </button>
          </div>

          {/* Waveform - Full Width */}
          <div className="flex-1 relative pt-6">
            {/* Marker labels - positioned above waveform */}
            {song.markers.length > 0 && duration > 0 && !isLoading && containerWidth > 0 && (
              <div className="absolute top-0 left-0 right-0 h-6 overflow-visible pointer-events-none z-10">
                {song.markers.map((marker) => {
                  // WaveSurfer scales waveform to at least fill container
                  const waveformWidth = Math.max(containerWidth, duration * zoom);
                  const pixelsPerSecond = waveformWidth / duration;
                  const markerX = marker.timestamp * pixelsPerSecond - scrollLeft;
                  // Only render if within visible bounds (with some padding)
                  if (markerX < -50 || markerX > containerWidth + 50) return null;
                  return (
                    <div
                      key={marker.id}
                      className="absolute bottom-0"
                      style={{ left: markerX, transform: "translateX(-50%)" }}
                    >
                      <span className="inline-block bg-yellow-400 text-black text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm">
                        {marker.name}
                      </span>
                      <div className="w-0 h-0 mx-auto border-l-4 border-r-4 border-t-4 border-transparent border-t-yellow-400" />
                    </div>
                  );
                })}
              </div>
            )}
            <div
              ref={waveformContainerRef}
              className="overflow-x-auto rounded bg-gray-900"
              style={{ contain: "inline-size" }}
            >
              <div ref={waveformRef} className="cursor-pointer" />
            </div>
            {isLoading && (
              <div className="absolute inset-0 top-5 flex items-center justify-center bg-gray-900 rounded">
                <span className="text-gray-500 text-sm">Loading...</span>
              </div>
            )}
          </div>

          {/* Markers Panel (below waveform) */}
          {showMarkers && !externalMarkersBar && (
            <div className="border-t border-gray-700 pt-2 mt-2">
              {/* Controls Row - Centered */}
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">Lead-in:</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={leadIn}
                    onChange={(e) => setLeadIn(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-12 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-center focus:outline-none focus:border-green-500"
                  />
                  <span className="text-xs text-gray-500">sec</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMarkerName}
                    onChange={(e) => setNewMarkerName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMarker()}
                    placeholder="Marker name"
                    className="w-32 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs focus:outline-none focus:border-green-500"
                  />
                  <button
                    onClick={addMarker}
                    disabled={!newMarkerName.trim()}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-xs"
                  >
                    Add
                  </button>
                </div>

                {song.markers.length > 0 && (
                  <button
                    onClick={() => onMarkersClear(song.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Markers List - Spread across full width and centered */}
              {song.markers.length > 0 && (
                <div className="flex flex-wrap justify-evenly items-center gap-2 mt-2 w-full">
                  {song.markers
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((marker: Marker) => (
                      <div
                        key={marker.id}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-xs group"
                      >
                        <button
                          onClick={() => jumpToMarker(marker.timestamp)}
                          className="text-green-400 font-mono"
                        >
                          {formatTime(marker.timestamp)}
                        </button>
                        {editingMarkerId === marker.id ? (
                          <input
                            type="text"
                            value={editingMarkerName}
                            onChange={(e) => setEditingMarkerName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingMarkerName.trim()) {
                                onMarkerRename(marker.id, editingMarkerName.trim());
                                setEditingMarkerId(null);
                              } else if (e.key === "Escape") {
                                setEditingMarkerId(null);
                              }
                            }}
                            onBlur={() => setEditingMarkerId(null)}
                            autoFocus
                            className="w-20 px-1 bg-gray-600 rounded text-xs"
                          />
                        ) : (
                          <>
                            <button
                              onClick={() => jumpToMarker(marker.timestamp)}
                            >
                              {marker.name}
                            </button>
                            <button
                              onClick={() => {
                                setEditingMarkerId(marker.id);
                                setEditingMarkerName(marker.name);
                              }}
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
                          onClick={() => onMarkerDelete(marker.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
}
