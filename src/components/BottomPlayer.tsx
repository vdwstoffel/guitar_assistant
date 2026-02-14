"use client";

import { useRef, useState, useEffect, useCallback, memo, useMemo } from "react";
import { Track, Marker, JamTrack, JamTrackMarker } from "@/types";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { playCountIn } from "@/lib/clickGenerator";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";

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
  // Count-in state
  isCountingIn: boolean;
  currentCountInBeat: number;
  totalCountInBeats: number;
  trackTempo: number | null;
  trackTimeSignature: string;
  volume: number;
}

interface BottomPlayerProps {
  track: Track | JamTrack | null;
  onMarkerAdd: (trackId: string, name: string, timestamp: number) => void;
  onMarkerUpdate: (markerId: string, timestamp: number) => void;
  onMarkerRename: (markerId: string, name: string) => void;
  onMarkerDelete: (markerId: string) => void;
  onMarkersClear: (trackId: string) => void;
  externalMarkersBar?: boolean;
  onMarkerBarStateChange?: (state: MarkerBarState) => void;
  onTimeUpdate?: (time: number, isPlaying: boolean) => void;
  onSeekReady?: (seekFn: (time: number) => void) => void;
}

function BottomPlayer({
  track,
  onMarkerAdd,
  onMarkerUpdate,
  onMarkerRename,
  onMarkerDelete,
  onMarkersClear,
  externalMarkersBar = false,
  onMarkerBarStateChange,
  onTimeUpdate,
  onSeekReady,
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
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showMarkers, setShowMarkers] = useState(false);
  const [newMarkerName, setNewMarkerName] = useState("");
  const [leadIn, setLeadIn] = useState(0);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarkerName, setEditingMarkerName] = useState("");
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [currentCountInBeat, setCurrentCountInBeat] = useState(0);
  const [totalCountInBeats, setTotalCountInBeats] = useState(0);
  const [stopMarker, setStopMarker] = useState<number | null>(null); // Timestamp where playback should stop
  const lastSeekPositionRef = useRef<number | null>(null); // Track where we seeked to avoid false stop triggers
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
  const isRepeatEnabledRef = useRef(false);
  const restartPlaybackRef = useRef<() => void>(() => {});
  const [showSplitChannels, setShowSplitChannels] = useState(false);

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
    if (track) {
      localStorage.setItem(`playbackSpeed_${track.id}`, clampedSpeed.toString());
      // Dispatch custom event to notify InProgressIndicator components
      window.dispatchEvent(new CustomEvent('playbackSpeedChange', {
        detail: { trackId: track.id, speed: clampedSpeed }
      }));
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
    if (!waveformRef.current || !track) return;

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
      height: showSplitChannels ? 120 : 140,
      normalize: true,
      minPxPerSec: 1,
      autoScroll: true,
      autoCenter: true,
      ...(showSplitChannels && {
        splitChannels: [
          { waveColor: '#4b5563', progressColor: '#22c55e' },
          { waveColor: '#3b4563', progressColor: '#1eb04e' }
        ]
      }),
      plugins: [regions],
    });

    regionsRef.current = regions;

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setIsLoading(false);

      // Apply saved playback speed for this track
      const savedSpeed = localStorage.getItem(`playbackSpeed_${track.id}`);
      const speed = savedSpeed ? parseInt(savedSpeed, 10) : 100;
      setPlaybackSpeed(speed);
      ws.setPlaybackRate(speed / 100, true);

      // Apply global volume
      const savedVolume = localStorage.getItem('globalVolume');
      const vol = savedVolume ? parseInt(savedVolume, 10) : 100;
      setVolume(vol);
      ws.setVolume(vol / 100);

      track.markers.forEach((marker) => {
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

      prevMarkerIdsRef.current = new Set(track.markers.map((m) => m.id));
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
    ws.on("finish", () => {
      if (isRepeatEnabledRef.current) {
        restartPlaybackRef.current();
      } else {
        setIsPlaying(false);
      }
    });

    ws.load(`/api/audio/${encodeURIComponent(track.filePath)}`);

    wavesurferRef.current = ws;
  }, [track, showSplitChannels]);

  useEffect(() => {
    if (track) {
      prevMarkerIdsRef.current = new Set();
      isInitialLoadRef.current = true;
      setStopMarker(null); // Clear stop marker when track changes
      setIsRepeatEnabled(false); // Reset repeat when track changes
      isRepeatEnabledRef.current = false;
      initWaveSurfer();
    }

    return () => {
      if (wavesurferRef.current) {
        try {
          // Stop playback to release audio resources
          wavesurferRef.current.stop();

          // Explicitly destroy regions plugin first
          if (regionsRef.current) {
            regionsRef.current.destroy();
            regionsRef.current = null;
          }

          // Destroy WaveSurfer instance
          wavesurferRef.current.destroy();
        } catch {
          // Ignore errors during cleanup (e.g., DOM already removed)
        }
        wavesurferRef.current = null;
      }
    };
  }, [track?.id]);

  // Handle split channels toggle - reinitialize waveform while preserving playback state
  useEffect(() => {
    // Skip on initial load or if no track/wavesurfer exists yet
    if (!track || !wavesurferRef.current || isInitialLoadRef.current) return;

    const wasPlaying = isPlaying;
    const currentPosition = currentTimeRef.current;
    const currentDuration = duration;

    // Reinitialize with new split channels setting
    initWaveSurfer();

    // Restore playback position after waveform is ready
    if (currentDuration > 0) {
      const checkReady = () => {
        if (wavesurferRef.current && wavesurferRef.current.getDuration() > 0) {
          const ws = wavesurferRef.current;
          ws.seekTo(currentPosition / ws.getDuration());
          if (wasPlaying) {
            ws.play();
          }
        }
      };

      // Use a small delay to ensure waveform is fully initialized
      const timeoutId = setTimeout(checkReady, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [showSplitChannels]);

  // Wheel zoom event listener - re-run when track changes or loading completes
  useEffect(() => {
    const container = waveformContainerRef.current;
    if (!container || !track) return;

    container.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheelZoom);
    };
  }, [handleWheelZoom, track, isLoading]);

  // Call onTimeUpdate when time or playing state changes
  useEffect(() => {
    if (onTimeUpdate) {
      onTimeUpdate(currentTime, isPlaying);
    }
  }, [currentTime, isPlaying, onTimeUpdate]);

  // Expose seek function for external control (e.g., alphaTab click-to-seek)
  useEffect(() => {
    if (onSeekReady && wavesurferRef.current && duration > 0) {
      const seekFn = (time: number) => {
        if (wavesurferRef.current && duration > 0) {
          const normalizedPosition = Math.max(0, Math.min(1, time / duration));
          wavesurferRef.current.seekTo(normalizedPosition);
        }
      };
      onSeekReady(seekFn);
    }
  }, [onSeekReady, duration]);

  // Track scroll position and container width for marker labels
  useEffect(() => {
    const container = waveformContainerRef.current;
    if (!container) return;

    let scrollRafId: number | null = null;
    let resizeRafId: number | null = null;

    const handleScroll = () => {
      // Throttle scroll updates with requestAnimationFrame to prevent
      // excessive state updates on every scroll event
      if (scrollRafId !== null) return;
      scrollRafId = requestAnimationFrame(() => {
        setScrollLeft(container.scrollLeft);
        scrollRafId = null;
      });
    };

    const handleResize = () => {
      // Throttle resize updates with requestAnimationFrame
      if (resizeRafId !== null) return;
      resizeRafId = requestAnimationFrame(() => {
        setContainerWidth(container.clientWidth);
        resizeRafId = null;
      });
    };

    // Initial measurement
    setContainerWidth(container.clientWidth);

    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      // Clean up any pending animation frames to prevent memory leaks
      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
      }
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
      }
    };
  }, [track, isLoading]);

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

      if (e.code === "KeyM" && track) {
        e.preventDefault();
        const markerCount = track.markers.length + 1;
        onMarkerAdd(track.id, `Marker ${markerCount}`, currentTime);
      }

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (wavesurferRef.current) {
          wavesurferRef.current.seekTo(0);
          wavesurferRef.current.play();
        }
      }

      if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [track, currentTime, onMarkerAdd]);

  // Stop playback when reaching stop marker
  useEffect(() => {
    if (stopMarker === null || !isPlaying || !wavesurferRef.current || !duration) return;

    // If we just seeked, wait until currentTime reflects the seek position
    const seekPos = lastSeekPositionRef.current;
    if (seekPos !== null) {
      // Only clear the guard if currentTime is actually near where we seeked
      // This prevents stale currentTime values from triggering false stops
      if (Math.abs(currentTime - seekPos) < 1) {
        lastSeekPositionRef.current = null;
      } else {
        return; // currentTime hasn't settled to the seek position yet
      }
    }

    // Only stop if we're approaching the stop marker from before (not already past it)
    if (currentTime >= stopMarker - 0.05 && currentTime < stopMarker + 1) {
      if (isRepeatEnabledRef.current) {
        restartPlaybackRef.current();
      } else {
        wavesurferRef.current.pause();
        wavesurferRef.current.seekTo(stopMarker / duration);
      }
    }
  }, [isPlaying, currentTime, duration, stopMarker]);

  // Update markers on waveform when they change
  useEffect(() => {
    if (!regionsRef.current || !track || isLoading || isInitialLoadRef.current) return;

    const currentMarkerIds = new Set(track.markers.map((m) => m.id));
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
    track.markers.forEach((marker) => {
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
  }, [track?.markers, isLoading]);

  const togglePlay = async () => {
    if (!wavesurferRef.current || !duration) return;

    // If playing, just pause
    if (isPlaying) {
      wavesurferRef.current.pause();
      return;
    }

    // Normal play - will stop at stopMarker if set
    wavesurferRef.current.play();
  };

  const restartFromBeginning = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.seekTo(0);
    wavesurferRef.current.play();
  };

  const restartPlayback = useCallback(async () => {
    if (!wavesurferRef.current || !duration || isCountingIn) return;

    wavesurferRef.current.seekTo(0);
    lastSeekPositionRef.current = 0;

    if (track?.tempo && track.tempo > 0) {
      const timeSignature = track.timeSignature || "4/4";
      const beats = parseInt(timeSignature.split("/")[0]) || 4;

      setIsCountingIn(true);
      setCurrentCountInBeat(0);
      setTotalCountInBeats(beats);

      await playCountIn({
        bpm: track.tempo,
        timeSignature,
        volume,
        onBeat: (beat, total) => {
          setCurrentCountInBeat(beat);
          setTotalCountInBeats(total);
        },
      });

      setIsCountingIn(false);
      setCurrentCountInBeat(0);
    }

    wavesurferRef.current?.play();
  }, [duration, isCountingIn, track?.tempo, track?.timeSignature, volume]);

  // Keep refs in sync for use in WaveSurfer event callbacks
  restartPlaybackRef.current = restartPlayback;

  const toggleRepeat = useCallback(() => {
    setIsRepeatEnabled(prev => {
      const next = !prev;
      isRepeatEnabledRef.current = next;
      return next;
    });
  }, []);

  const jumpToMarker = useCallback(async (timestamp: number) => {
    if (!wavesurferRef.current || !duration) return;

    // If track has tempo, use beat-based count-in
    if (track?.tempo && track.tempo > 0) {
      const timeSignature = track.timeSignature || "4/4";
      const beats = parseInt(timeSignature.split("/")[0]) || 4;

      setIsCountingIn(true);
      setCurrentCountInBeat(0);
      setTotalCountInBeats(beats);

      // Seek to marker position (paused)
      wavesurferRef.current.seekTo(timestamp / duration);
      lastSeekPositionRef.current = timestamp; // Guard against false stop triggers

      // Play count-in clicks
      await playCountIn({
        bpm: track.tempo,
        timeSignature,
        volume,
        onBeat: (beat, total) => {
          setCurrentCountInBeat(beat);
          setTotalCountInBeats(total);
        },
      });

      setIsCountingIn(false);
      setCurrentCountInBeat(0);

      // Start playback
      wavesurferRef.current?.play();
    } else {
      // Fallback to seconds-based lead-in
      const startTime = Math.max(0, timestamp - leadIn);
      wavesurferRef.current.seekTo(startTime / duration);
      lastSeekPositionRef.current = startTime; // Guard against false stop triggers
      wavesurferRef.current.play();
    }
  }, [duration, leadIn, track?.tempo, track?.timeSignature, volume]);

  const addMarker = useCallback(() => {
    if (!track || !newMarkerName.trim()) return;
    onMarkerAdd(track.id, newMarkerName.trim(), currentTimeRef.current);
    setNewMarkerName("");
  }, [track, newMarkerName, onMarkerAdd]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Handle marker label click to set/clear stop marker
  const handleMarkerLabelClick = useCallback((timestamp: number) => {
    setStopMarker((prev) => (prev === timestamp ? null : timestamp));
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
          currentTime: currentTimeRef.current,
          jumpToMarker,
          addMarker,
          formatTime,
          isCountingIn,
          currentCountInBeat,
          totalCountInBeats,
          trackTempo: track?.tempo ?? null,
          trackTimeSignature: track?.timeSignature || "4/4",
          volume,
        });
      }
    }, 16); // Debounce to ~60fps

    return () => {
      if (stateCallbackTimeoutRef.current) {
        clearTimeout(stateCallbackTimeoutRef.current);
      }
    };
  // Note: currentTime is accessed via currentTimeRef.current to avoid effect firing on every time update (~20/sec)
  }, [showMarkers, newMarkerName, leadIn, editingMarkerId, editingMarkerName, jumpToMarker, addMarker, formatTime, isCountingIn, currentCountInBeat, totalCountInBeats, track?.tempo, track?.timeSignature, volume]);

  if (!track) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-800 border-t border-gray-700 text-gray-500">
        <p>Select a track to play</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-800 border-t border-gray-700 text-white">
      <KeyboardShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
      {/* Main Player Section */}
      <div className="flex-1 flex flex-col px-2 sm:px-4 py-2">
          {/* Controls - Multi-row responsive layout */}
          <div className="flex flex-col gap-2 mb-2">
            {/* Row 1: Primary playback controls */}
            <div className="flex items-center justify-center gap-3 sm:gap-6 text-xs">
            {/* Restart Button */}
            <button
              onClick={restartFromBeginning}
              disabled={isLoading}
              className="w-11 h-11 sm:w-10 sm:h-10 md:w-8 md:h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 rounded-full transition-colors flex-shrink-0"
              title="Restart from beginning"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="5" width="3" height="14" />
                <path d="M9 12l10-7v14z" />
              </svg>
            </button>

            {/* Repeat Button */}
            <button
              onClick={toggleRepeat}
              disabled={isLoading}
              className={`w-11 h-11 sm:w-10 sm:h-10 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                isRepeatEnabled
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-400"
              }`}
              title={isRepeatEnabled ? "Repeat on" : "Repeat off"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 11V9a4 4 0 014-4h14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 23l-4-4 4-4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
            </button>

            {/* Play Button */}
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-full transition-colors flex-shrink-0"
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
          </div>

          {/* Row 2: Secondary controls - Wrap on mobile */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs">
            {/* Speed */}
            <div className="flex items-center gap-1 sm:gap-2">
              {[50, 75, 90, 100].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePlaybackSpeed(preset)}
                  className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                    playbackSpeed === preset
                      ? "bg-green-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600"
                  }`}
                >
                  {preset}
                </button>
              ))}
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
                className="w-12 sm:w-16 px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-center text-xs focus:outline-none focus:border-green-500"
              />
              <span className="text-gray-500 text-xs">%</span>
            </div>

            {/* Zoom - Hide on mobile */}
            <div className="hidden md:flex items-center gap-2">
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
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => handleVolume(volume === 0 ? 100 : 0)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white"
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
                className="w-16 sm:w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>

            {/* Split Channels Toggle */}
            <button
              onClick={() => setShowSplitChannels(!showSplitChannels)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs ${
                showSplitChannels ? "bg-blue-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
              title={showSplitChannels ? "Show merged channels" : "Show split channels (L/R)"}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {showSplitChannels ? "Split" : "Mono"}
            </button>

            {/* Markers Toggle */}
            <button
              onClick={() => setShowMarkers(!showMarkers)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs ${
                showMarkers ? "bg-yellow-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Markers ({track.markers.length})
            </button>
          </div>
        </div>

          {/* Waveform - Responsive height */}
          <div className={`relative pt-6 ${showSplitChannels ? 'h-[250px] sm:h-[300px]' : 'h-[140px] sm:h-[200px]'}`}>
            {/* Marker labels - positioned above waveform */}
            {track.markers.length > 0 && duration > 0 && !isLoading && containerWidth > 0 && (
              <div className="absolute top-0 left-0 right-0 h-6 overflow-visible pointer-events-none z-10">
                {track.markers.map((marker) => {
                  // WaveSurfer scales waveform to at least fill container
                  const waveformWidth = Math.max(containerWidth, duration * zoom);
                  const pixelsPerSecond = waveformWidth / duration;
                  const markerX = marker.timestamp * pixelsPerSecond - scrollLeft;
                  // Only render if within visible bounds (with some padding)
                  if (markerX < -50 || markerX > containerWidth + 50) return null;

                  // Check if this marker is the stop marker
                  const isStopMarker = stopMarker === marker.timestamp;

                  return (
                    <div
                      key={marker.id}
                      className="absolute bottom-0 pointer-events-auto"
                      style={{ left: markerX, transform: "translateX(-50%)" }}
                    >
                      <button
                        onClick={() => handleMarkerLabelClick(marker.timestamp)}
                        className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm cursor-pointer transition-colors ${
                          isStopMarker
                            ? "bg-red-500 hover:bg-red-400 text-white"
                            : "bg-yellow-400 hover:bg-yellow-300 text-black"
                        }`}
                      >
                        {marker.name}
                      </button>
                      <div className={`w-0 h-0 mx-auto border-l-4 border-r-4 border-t-4 border-transparent ${
                        isStopMarker ? "border-t-red-500" : "border-t-yellow-400"
                      }`} />
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

                {track.markers.length > 0 && (
                  <button
                    onClick={() => onMarkersClear(track.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Markers List - Spread across full width and centered */}
              {track.markers.length > 0 && (
                <div className="flex flex-wrap justify-evenly items-center gap-2 mt-2 w-full">
                  {[...track.markers]
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((marker) => (
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

export default memo(BottomPlayer);
