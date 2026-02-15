"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface SyncData {
  bpm: number;
  restBars: number;
  /** Array of [audioTimeSec, alphaTabTimeMs] pairs */
  points: [number, number][];
}

interface AlphaTexViewerProps {
  /** Relative file path to the .alphatex file (used for API fetch URL) */
  filePath: string;
  /** Current audio playback time in seconds from BottomPlayer */
  currentAudioTime: number;
  /** Whether audio is currently playing */
  audioIsPlaying: boolean;
}

export default function AlphaTexViewer({
  filePath,
  currentAudioTime,
  audioIsPlaying,
}: AlphaTexViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const syncDataRef = useRef<SyncData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSyncTime = useRef(0);

  // Initialize alphaTab with AlphaTex content
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    let destroyed = false;
    playerReadyRef.current = false;

    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch the AlphaTex content and sync data in parallel
        const syncFilePath = filePath.replace(/\.alphatex$/, ".sync.json");
        const [response, syncResponse] = await Promise.all([
          fetch(`/api/alphatex/${filePath}`),
          fetch(`/api/alphatex/${syncFilePath}`).catch(() => null),
        ]);
        if (!response.ok) {
          throw new Error("Failed to load tab data");
        }
        const texContent = await response.text();

        // Load sync data if available
        if (syncResponse?.ok) {
          try {
            syncDataRef.current = await syncResponse.json();
          } catch {
            syncDataRef.current = null;
          }
        }

        if (destroyed) return;

        // Initialize alphaTab
        const alphaTab = await import("@coderline/alphatab");
        const { AlphaTabApi, Settings } = alphaTab;

        if (destroyed) return;

        const settings = new Settings();
        settings.core.fontDirectory = "/font/";
        settings.core.useWorkers = false;
        settings.core.tex = true;
        settings.display.layoutMode = alphaTab.LayoutMode.Page;
        settings.display.stretchForce = 0.95;
        settings.display.scale = 0.98;
        // Use ExternalMedia player mode: lightweight player that supports cursor
        // positioning without needing a sound font or audio synthesizer.
        // Audio playback is handled by BottomPlayer; we just sync the cursor.
        settings.player.playerMode = alphaTab.PlayerMode.EnabledExternalMedia;
        settings.player.enableCursor = true;
        settings.player.enableUserInteraction = false;
        // Disable built-in scrolling - we'll implement custom scroll logic
        settings.player.scrollMode = alphaTab.ScrollMode.Off;

        const api = new AlphaTabApi(containerRef.current!, settings);
        apiRef.current = api;

        api.scoreLoaded.on(() => {
          if (!destroyed) {
            setIsLoading(false);
          }
        });

        // Player ready for playback (MIDI loaded) - now play/pause/seek will work
        api.playerReady.on(() => {
          if (!destroyed) {
            playerReadyRef.current = true;
          }
        });

        api.error.on((e: any) => {
          if (!destroyed) {
            let errorMsg = e.message || "Failed to render tab";
            const inner = e.error || e.innerError;
            if (inner) {
              errorMsg = inner.message || errorMsg;
              for (const key of [
                "lexerDiagnostics",
                "parserDiagnostics",
                "semanticDiagnostics",
              ]) {
                const diag = inner[key];
                if (diag?.items?.length) {
                  console.error(`alphaTab ${key}:`, diag.items);
                }
              }
              if (inner.innerError) {
                errorMsg += `: ${inner.innerError.message || JSON.stringify(inner.innerError)}`;
              }
            }
            console.error("alphaTab error:", e);
            setError(errorMsg);
            setIsLoading(false);
          }
        });

        // Load the AlphaTex content
        api.tex(texContent);
      } catch (err) {
        if (!destroyed) {
          setError(
            err instanceof Error ? err.message : "Failed to initialize tab viewer"
          );
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      playerReadyRef.current = false;
      syncDataRef.current = null;
      if (apiRef.current) {
        try {
          apiRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        apiRef.current = null;
      }
    };
  }, [filePath]);

  // Sync play/pause state with BottomPlayer
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !playerReadyRef.current) return;

    try {
      if (audioIsPlaying) {
        api.play();
      } else {
        api.pause();
      }
    } catch {
      // Ignore if player not ready yet
    }
  }, [audioIsPlaying]);

  // Interpolate audio time to alphaTab MIDI time using beat grid sync data.
  // The SNG beat grid has exact timing for every beat, so interpolating between
  // grid points avoids cumulative drift from using a single averaged BPM.
  const audioTimeToAlphaTabTime = useCallback(
    (audioTimeSec: number): number => {
      const sync = syncDataRef.current;
      if (!sync || sync.points.length === 0) {
        // Fallback: simple conversion (will drift over time)
        return audioTimeSec * 1000;
      }

      const pts = sync.points;

      // Before first sync point
      if (audioTimeSec <= pts[0][0]) {
        return pts[0][1] - (pts[0][0] - audioTimeSec) * 1000;
      }

      // After last sync point
      if (audioTimeSec >= pts[pts.length - 1][0]) {
        const last = pts[pts.length - 1];
        return last[1] + (audioTimeSec - last[0]) * 1000;
      }

      // Binary search for the surrounding sync points
      let lo = 0;
      let hi = pts.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (pts[mid][0] <= audioTimeSec) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      // Linear interpolation between pts[lo] and pts[hi]
      const [aLo, mLo] = pts[lo];
      const [aHi, mHi] = pts[hi];
      const t = (audioTimeSec - aLo) / (aHi - aLo);
      return mLo + t * (mHi - mLo);
    },
    []
  );

  // Sync cursor position with audio playback time
  const syncCursor = useCallback(() => {
    const api = apiRef.current;
    if (!api || !playerReadyRef.current || !audioIsPlaying) return;

    const timeDiff = Math.abs(currentAudioTime - lastSyncTime.current);
    if (timeDiff < 0.05) return;

    lastSyncTime.current = currentAudioTime;

    try {
      api.timePosition = audioTimeToAlphaTabTime(currentAudioTime);
    } catch {
      // Ignore cursor sync errors
    }
  }, [currentAudioTime, audioIsPlaying, audioTimeToAlphaTabTime]);

  useEffect(() => {
    syncCursor();
  }, [syncCursor]);

  // Custom auto-scroll: check cursor position and scroll to keep it centered
  useEffect(() => {
    if (!containerRef.current || !audioIsPlaying) return;

    const checkAndScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const cursorBar = container.querySelector('.at-cursor-bar') as HTMLElement;
      if (!cursorBar) return;

      const containerRect = container.getBoundingClientRect();
      const cursorRect = cursorBar.getBoundingClientRect();

      // Calculate cursor position relative to container viewport
      const cursorRelativeTop = cursorRect.top - containerRect.top + container.scrollTop;
      const cursorPositionInViewport = cursorRect.top - containerRect.top;

      // Trigger scroll when cursor is at 65% down the viewport
      const triggerThreshold = containerRect.height * 0.65;

      // Target position: 35% from top (gives room to read ahead)
      const targetPosition = containerRect.height * 0.35;

      if (cursorPositionInViewport > triggerThreshold) {
        // Scroll to position cursor at target position
        const newScrollTop = cursorRelativeTop - targetPosition;
        container.scrollTo({
          top: newScrollTop,
          behavior: 'smooth'
        });
      }
    };

    // Check scroll position periodically while playing
    const interval = setInterval(checkAndScroll, 150);
    return () => clearInterval(interval);
  }, [audioIsPlaying]);

  return (
    <div className="relative flex flex-col h-full bg-gray-900">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
          <span className="text-gray-500 text-sm">Loading tab...</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900 text-red-400 text-sm px-4">
          <span className="text-center">Error: {error}</span>
        </div>
      )}

      <style jsx global>{`
        .at-surface {
          background: white !important;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          margin: 0 auto 16px auto;
          overflow: hidden;
          width: 100% !important;
        }
        .at-surface svg {
          display: block;
          width: 100% !important;
          height: auto;
        }
        .at-cursor-bar {
          background: rgba(168, 85, 247, 0.15) !important;
        }
        .at-cursor-beat {
          background: rgba(168, 85, 247, 0.6) !important;
          width: 3px !important;
        }
        .at-selection div {
          background: rgba(168, 85, 247, 0.1) !important;
        }
      `}</style>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{
          width: "100%",
          background: "#1f2937",
          borderRadius: "4px",
          padding: "8px",
          overflowX: "hidden",
        }}
      />
    </div>
  );
}
