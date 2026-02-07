"use client";

import { useEffect, useRef, useState } from "react";
import { TabSyncPoint } from "@/types";
import { interpolateTickPosition, interpolateAudioTime } from "@/lib/tabSync";

interface AlphaTabViewerProps {
  tabPath: string;
  syncPoints: TabSyncPoint[];
  currentAudioTime: number;
  onSeek: (audioTime: number) => void;
  onTabClick?: (tabTick: number, barIndex: number) => void;
  syncEditMode: boolean;
  version?: number;
}

export default function AlphaTabViewer({
  tabPath,
  syncPoints,
  currentAudioTime,
  onSeek,
  onTabClick,
  syncEditMode,
  version = 0,
}: AlphaTabViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<unknown>(null);
  const initRef = useRef(false);
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const lastTickRef = useRef<number>(-Infinity);

  // Store current values in refs for use in callbacks
  const syncPointsRef = useRef(syncPoints);
  const syncEditModeRef = useRef(syncEditMode);
  const onTabClickRef = useRef(onTabClick);
  const onSeekRef = useRef(onSeek);

  useEffect(() => {
    syncPointsRef.current = syncPoints;
  }, [syncPoints]);

  useEffect(() => {
    syncEditModeRef.current = syncEditMode;
  }, [syncEditMode]);

  useEffect(() => {
    onTabClickRef.current = onTabClick;
  }, [onTabClick]);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  // Initialize alphaTab
  useEffect(() => {
    if (initRef.current) return;
    if (!containerRef.current) return;

    initRef.current = true;

    const container = containerRef.current;
    let api: unknown = null;

    const init = async () => {
      try {
        setStatus("Loading alphaTab library...");
        const alphaTab = await import("@coderline/alphatab");

        setStatus("Creating API...");

        const encodedPath = tabPath
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/");
        const fileUrl = `/api/tab/${encodedPath}?v=${version}`;

        setStatus(`Loading: ${fileUrl}`);

        api = new alphaTab.AlphaTabApi(container, {
          core: {
            fontDirectory: "/fonts/alphatab/",
            file: fileUrl,
            useWorkers: false,
          },
          display: {
            layoutMode: alphaTab.LayoutMode.Page,
            staveProfile: alphaTab.StaveProfile.Tab,
          },
          player: {
            // Use external media mode - designed for syncing with external audio like WaveSurfer
            playerMode: alphaTab.PlayerMode.EnabledExternalMedia,
            enableCursor: true,
            enableUserInteraction: true,
          },
        });

        apiRef.current = api;

        const typedApi = api as {
          scoreLoaded: { on: (handler: () => void) => void };
          renderStarted: { on: (handler: () => void) => void };
          renderFinished: { on: (handler: () => void) => void };
          playerReady: { on: (handler: () => void) => void };
          error: { on: (handler: (e: unknown) => void) => void };
          beatMouseDown: {
            on: (handler: (beat: unknown, originalEvent: unknown) => void) => void;
          };
          tickPosition: number;
        };

        typedApi.scoreLoaded.on(() => {
          setStatus("Score loaded, rendering...");
        });

        typedApi.renderStarted.on(() => {
          setStatus("Rendering...");
        });

        typedApi.renderFinished.on(() => {
          setStatus("");
          setIsReady(true);
        });

        typedApi.playerReady.on(() => {
          setIsReady(true);
        });

        typedApi.error.on((e) => {
          console.error("[AlphaTab] Error:", e);
          setError(String(e));
          setStatus("");
        });

        // Handle clicks on the notation
        typedApi.beatMouseDown.on((beat) => {
          // Access as 'any' to get computed getter values
          const beatAny = beat as Record<string, unknown>;
          const voiceAny = beatAny.voice as Record<string, unknown> | undefined;
          const barAny = voiceAny?.bar as Record<string, unknown> | undefined;
          const masterBarAny = barAny?.masterBar as Record<string, unknown> | undefined;

          // Get the masterBar start (absolute position of the bar) + playbackStart (position within bar)
          const masterBarStart = (masterBarAny?.start as number) ?? 0;
          const playbackStart = (beatAny.playbackStart as number) ?? 0;
          const absoluteTick = masterBarStart + playbackStart;

          // Also try the getter directly
          const absolutePlaybackStart = beatAny.absolutePlaybackStart as number | undefined;

          // Get the masterBar index (global bar number)
          const masterBarIndex = (masterBarAny?.index as number) ?? 0;

          // Use the computed absolute tick, or fall back to the getter
          const tick = absoluteTick || absolutePlaybackStart || 0;

          setSelectedTick(tick);
          // Use masterBarIndex for display (this is the global bar number)
          setSelectedBar(masterBarIndex);

          // In sync edit mode, notify parent of the clicked position
          if (syncEditModeRef.current && onTabClickRef.current) {
            onTabClickRef.current(tick, masterBarIndex);
          }
          // In normal mode, seek audio if we have enough sync points
          else if (!syncEditModeRef.current && syncPointsRef.current.length >= 2) {
            const audioTime = interpolateAudioTime(tick, syncPointsRef.current);
            if (audioTime !== null && onSeekRef.current) {
              onSeekRef.current(audioTime);
            }
          }
        });

      } catch (err) {
        console.error("[AlphaTab] Init failed:", err);
        setError(String(err));
        setStatus("");
      }
    };

    init();

    return () => {
      if (api) {
        try {
          (api as { destroy: () => void }).destroy();
        } catch (e) {
          console.error("[AlphaTab] Destroy error:", e);
        }
      }
      apiRef.current = null;
      initRef.current = false;
      setIsReady(false);
    };
  }, [tabPath, version]);

  // Reset lastTickRef when sync points change or exiting sync edit mode to force cursor update
  useEffect(() => {
    lastTickRef.current = -Infinity;
  }, [syncPoints, syncEditMode]);

  // Update cursor position based on audio time (when playing)
  useEffect(() => {
    if (!apiRef.current || !isReady || syncPoints.length < 2 || syncEditMode) {
      return;
    }

    const tick = interpolateTickPosition(currentAudioTime, syncPoints);
    if (tick === null) return;

    // Only update if tick changed significantly
    if (Math.abs(tick - lastTickRef.current) < 50) {
      return;
    }
    lastTickRef.current = tick;

    try {
      const api = apiRef.current as {
        tickPosition: number;
      };
      const targetTick = Math.round(tick);

      // Set alphaTab's tick position - this moves the cursor
      api.tickPosition = targetTick;

      // Scroll to keep cursor visible - trigger early so user can see upcoming bars
      setTimeout(() => {
        const scrollContainer = scrollContainerRef.current;
        const alphaTabContainer = containerRef.current;
        if (scrollContainer && alphaTabContainer) {
          const barCursor = alphaTabContainer.querySelector('.at-cursor-bar') as HTMLElement | null;
          if (barCursor) {
            const cursorRect = barCursor.getBoundingClientRect();
            const scrollRect = scrollContainer.getBoundingClientRect();
            const viewHeight = scrollRect.bottom - scrollRect.top;

            // Scroll when cursor enters the bottom 30% of view (to show ~5 bars ahead)
            // or when cursor is above the top of view
            const isAboveView = cursorRect.bottom < scrollRect.top + 50;
            const isInBottomZone = cursorRect.top > scrollRect.top + (viewHeight * 0.7);

            if (isAboveView || isInBottomZone) {
              // Scroll so cursor is near the top (25% from top) to show more upcoming bars
              barCursor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      }, 50);
    } catch (e) {
      console.error("[AlphaTab Sync] Error updating cursor:", e);
    }
  }, [currentAudioTime, syncPoints, syncEditMode, isReady]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 text-red-400 p-4">
        <div className="text-center max-w-lg">
          <p className="text-lg font-medium mb-2">Failed to load tab</p>
          <p className="text-sm text-zinc-500 break-all">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="relative h-full w-full bg-white overflow-auto">
      {status && (
        <div className="absolute top-4 left-4 right-4 z-10 bg-zinc-800 text-zinc-300 px-4 py-2 rounded text-sm">
          {status}
        </div>
      )}

      {syncEditMode && (
        <div className="absolute top-4 left-4 right-4 z-20 bg-amber-500 text-black px-4 py-2 rounded text-sm">
          <strong>Sync Edit Mode:</strong> Click on the notation to select a position.
          {selectedTick !== null && (
            <span className="ml-2">
              Selected: Bar {(selectedBar ?? 0) + 1} (tick {selectedTick})
            </span>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="alphatab-container"
        style={{ minHeight: "600px", width: "100%", background: "white", paddingTop: syncEditMode ? "60px" : "0" }}
      />

      <style jsx global>{`
        .at-cursor-bar {
          background: rgba(147, 51, 234, 0.1) !important;
        }
        .at-cursor-beat {
          background: rgba(147, 51, 234, 0.8) !important;
          width: 3px !important;
        }
        .at-highlight * {
          fill: #9333ea !important;
        }
        .at-surface {
          background: white;
        }
        .at-main {
          width: 100% !important;
        }
      `}</style>
    </div>
  );
}
