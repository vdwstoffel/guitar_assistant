"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSyncTime = useRef(0);

  // Initialize alphaTab with AlphaTex content
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    let destroyed = false;

    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch the AlphaTex content
        const response = await fetch(`/api/alphatex/${filePath}`);
        if (!response.ok) {
          throw new Error("Failed to load tab data");
        }
        const texContent = await response.text();

        if (destroyed) return;

        // Initialize alphaTab
        const alphaTab = await import("@coderline/alphatab");
        const { AlphaTabApi, Settings } = alphaTab;

        if (destroyed) return;

        const settings = new Settings();
        settings.core.fontDirectory = "/font/";
        settings.core.useWorkers = false;
        settings.core.tex = true; // Enable AlphaTex mode
        settings.display.layoutMode = alphaTab.LayoutMode.Page;
        settings.display.stretchForce = 0.95;
        settings.display.scale = 0.98;
        // Disable the built-in player - we use BottomPlayer for audio
        settings.player.enablePlayer = false;
        settings.player.enableCursor = true;
        settings.player.enableUserInteraction = false;

        const api = new AlphaTabApi(containerRef.current!, settings);
        apiRef.current = api;

        api.scoreLoaded.on(() => {
          if (!destroyed) {
            setIsLoading(false);
          }
        });

        api.error.on((e: any) => {
          if (!destroyed) {
            let errorMsg = e.message || "Failed to render tab";
            // Extract diagnostics from AlphaTexErrorWithDiagnostics
            const inner = e.error || e.innerError;
            if (inner) {
              errorMsg = inner.message || errorMsg;
              // Log all diagnostic collections for debugging
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

  // Sync cursor position with audio playback time
  const syncCursor = useCallback(() => {
    if (!apiRef.current || !audioIsPlaying) return;

    // Only sync if time has changed meaningfully (avoid excessive updates)
    const timeDiff = Math.abs(currentAudioTime - lastSyncTime.current);
    if (timeDiff < 0.05) return;

    lastSyncTime.current = currentAudioTime;

    try {
      // alphaTab timePosition is in milliseconds
      apiRef.current.timePosition = currentAudioTime * 1000;
    } catch {
      // Ignore cursor sync errors (can happen before score is fully loaded)
    }
  }, [currentAudioTime, audioIsPlaying]);

  useEffect(() => {
    syncCursor();
  }, [syncCursor]);

  return (
    <div className="relative flex flex-col h-full bg-gray-900">
      {/* Loading/error overlays - positioned above the container so alphaTab always has dimensions */}
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
