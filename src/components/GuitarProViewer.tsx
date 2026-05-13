"use client";

import { useEffect, useRef, useState } from "react";

interface GuitarProViewerProps {
  /** Relative path under MUSIC_DIR (no leading slash). */
  filePath: string;
}

interface AlphaTabTrack {
  index: number;
  name: string;
}

export default function GuitarProViewer({ filePath }: GuitarProViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<AlphaTabTrack[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    let destroyed = false;
    setIsLoading(true);
    setError(null);
    setTracks([]);
    setSelectedIndex(0);

    const init = async () => {
      try {
        const alphaTab = await import("@coderline/alphatab");
        const { AlphaTabApi, Settings } = alphaTab;
        if (destroyed) return;

        const settings = new Settings();
        settings.core.fontDirectory = "/font/";
        settings.core.useWorkers = false;
        settings.display.layoutMode = alphaTab.LayoutMode.Page;
        settings.display.stretchForce = 0.95;
        settings.display.scale = 0.98;
        settings.player.playerMode = alphaTab.PlayerMode.Disabled;
        settings.player.enableCursor = false;

        const api = new AlphaTabApi(containerRef.current!, settings);
        apiRef.current = api;

        api.scoreLoaded.on(() => {
          if (destroyed || !api.score) return;
          const list: AlphaTabTrack[] = api.score.tracks.map(
            (t: any, i: number) => ({ index: i, name: t.name || `Track ${i + 1}` }),
          );
          setTracks(list);
          setIsLoading(false);
        });

        api.error.on((e: any) => {
          if (destroyed) return;
          const inner = e.error || e.innerError;
          const msg = inner?.message || e.message || "Failed to render tab";
          console.error("alphaTab GP error:", e);
          setError(msg);
          setIsLoading(false);
        });

        api.load(`/api/gp/${filePath}`);
      } catch (err) {
        if (!destroyed) {
          setError(err instanceof Error ? err.message : "Failed to initialize");
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
          /* ignore */
        }
        apiRef.current = null;
      }
    };
  }, [filePath]);

  // Render only the selected track when the user picks one from the dropdown.
  useEffect(() => {
    if (!apiRef.current || tracks.length === 0) return;
    try {
      apiRef.current.renderTracks([apiRef.current.score.tracks[selectedIndex]]);
    } catch (err) {
      console.error("Failed to switch track:", err);
    }
  }, [selectedIndex, tracks]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {tracks.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-900">
          <label className="text-neutral-400 text-sm">Track:</label>
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(parseInt(e.target.value, 10))}
            className="px-2 py-1 bg-neutral-800 text-white rounded border border-neutral-700 text-sm focus:outline-none focus:border-purple-500"
          >
            {tracks.map((t) => (
              <option key={t.index} value={t.index}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="relative flex-1 overflow-auto bg-white">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
            Loading tab...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm p-4 text-center">
            Error rendering tab: {error}
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  );
}
