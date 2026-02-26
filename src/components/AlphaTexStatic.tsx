"use client";

import { useEffect, useRef, useState } from "react";

interface AlphaTexStaticProps {
  alphatex: string;
}

export default function AlphaTexStatic({ alphatex }: AlphaTexStaticProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    let destroyed = false;

    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const alphaTab = await import("@coderline/alphatab");
        const { AlphaTabApi, Settings } = alphaTab;

        if (destroyed) return;

        const settings = new Settings();
        settings.core.fontDirectory = "/font/";
        settings.core.useWorkers = false;
        settings.core.tex = true;
        settings.display.layoutMode = alphaTab.LayoutMode.Page;
        settings.display.stretchForce = 0.95;
        settings.display.scale = 0.9;
        settings.player.playerMode = alphaTab.PlayerMode.Disabled;
        settings.player.enableCursor = false;

        const api = new AlphaTabApi(containerRef.current!, settings);
        apiRef.current = api;

        api.scoreLoaded.on(() => {
          if (!destroyed) setIsLoading(false);
        });

        api.error.on((e: any) => {
          if (!destroyed) {
            const inner = e.error || e.innerError;
            const msg = inner?.message || e.message || "Failed to render tab";
            console.error("alphaTab error:", e);
            setError(msg);
            setIsLoading(false);
          }
        });

        api.tex(alphatex);
      } catch (err) {
        if (!destroyed) {
          setError(err instanceof Error ? err.message : "Failed to initialize tab");
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      if (apiRef.current) {
        try { apiRef.current.destroy(); } catch { /* ignore */ }
        apiRef.current = null;
      }
    };
  }, [alphatex]);

  return (
    <div className="relative my-4">
      {isLoading && (
        <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
          Loading tab...
        </div>
      )}
      {error && (
        <div className="text-red-400 text-sm py-2">Error rendering tab: {error}</div>
      )}
      <style jsx global>{`
        .at-surface {
          background: white !important;
          border-radius: 4px;
          margin: 0 auto 8px auto;
          overflow: hidden;
          width: 100% !important;
        }
        .at-surface svg {
          display: block;
          width: 100% !important;
          height: auto;
        }
      `}</style>
      <div
        ref={containerRef}
        style={{ width: "100%", background: "#1f2937", borderRadius: "4px", padding: "8px" }}
      />
    </div>
  );
}
