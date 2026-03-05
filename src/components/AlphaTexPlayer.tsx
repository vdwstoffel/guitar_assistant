"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { Track, TrackTab } from "@/types";
import type { TabData } from "@/lib/tabData";
import {
  isTabDataJson,
  parseTabData,
  tabDataToAlphaTex,
  createDefaultTabData,
} from "@/lib/tabData";
import { usePracticeSessionTracker } from "@/hooks/usePracticeSessionTracker";
import VisualTabEditor from "./VisualTabEditor";

interface AlphaTexPlayerProps {
  track: Track;
  tab: TrackTab;
  onClose: () => void;
  onSave: (tabId: string, updates: Partial<TrackTab>) => Promise<void>;
}

export default function AlphaTexPlayer({ track, tab, onClose, onSave }: AlphaTexPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [volume, setVolume] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("alphatab-volume");
      if (stored) return parseFloat(stored);
    }
    return 0.8;
  });
  const [practiseBpm, setPractiseBpm] = useState(tab.tempo);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(tab.name);
  const [editTabData, setEditTabData] = useState<TabData>(() => {
    if (tab.alphatex && isTabDataJson(tab.alphatex)) {
      return parseTabData(tab.alphatex) ?? createDefaultTabData(tab.tempo);
    }
    return createDefaultTabData(tab.tempo);
  });
  const [isSaving, setIsSaving] = useState(false);
  const [currentTab, setCurrentTab] = useState(tab);
  const pendingAutoPlay = useRef(false);
  const sessionTracker = usePracticeSessionTracker(track, practiseBpm);
  const sessionTrackerRef = useRef(sessionTracker);
  sessionTrackerRef.current = sessionTracker;

  // Resolve the alphatex to render: JSON → AlphaTex, raw AlphaTex → pass through
  const resolvedAlphaTex = useMemo(() => {
    if (!currentTab.alphatex) return null;
    if (isTabDataJson(currentTab.alphatex)) {
      const data = parseTabData(currentTab.alphatex);
      return data ? tabDataToAlphaTex(data) : null;
    }
    return currentTab.alphatex;
  }, [currentTab.alphatex]);

  // Initialise alphaTab with PlayerMode.EnabledSynthesizer whenever resolvedAlphaTex changes
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    if (!resolvedAlphaTex) return;

    let destroyed = false;

    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setIsPlaying(false);

        const alphaTab = await import("@coderline/alphatab");
        const { AlphaTabApi, Settings, Environment } = alphaTab;

        if (destroyed) return;

        // Provide explicit worker/worklet URLs so alphaTab doesn't try to
        // auto-detect from import.meta.url (which points to the bundled chunk).
        if (!Environment.isRunningInWorker) {
          Environment.initializeMain(
            () => new Worker("/alphaTab.worker.mjs", { type: "module" }),
            (ctx: AudioContext) => ctx.audioWorklet.addModule("/alphaTab.worklet.mjs")
          );
        }

        const settings = new Settings();
        settings.core.fontDirectory = "/font/";
        settings.core.tex = true;
        settings.display.layoutMode = alphaTab.LayoutMode.Page;
        settings.display.stretchForce = 0.95;
        settings.display.scale = 0.9;
        settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
        settings.player.soundFont = "/soundfont/sonivox.sf2";
        settings.player.enableCursor = true;
        settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
        settings.player.scrollElement = scrollRef.current!;

        const api = new AlphaTabApi(containerRef.current!, settings);
        api.countInVolume = 3;
        api.metronomeVolume = 3;
        api.masterVolume = volume;
        api.isLooping = isLooping;
        apiRef.current = api;

        api.playerStateChanged.on((e: any) => {
          if (!destroyed) {
            const playing = e.state === 1;
            setIsPlaying(playing);
            if (playing) {
              sessionTrackerRef.current.onPlay();
            } else {
              sessionTrackerRef.current.onPause();
            }
          }
        });

        api.playerFinished.on(() => {
          if (!destroyed) sessionTrackerRef.current.onFinish();
        });

        api.scoreLoaded.on(() => {
          if (!destroyed) setIsLoading(false);
        });

        api.renderFinished.on(() => {
          if (!destroyed && pendingAutoPlay.current) {
            pendingAutoPlay.current = false;
            try { api.play(); } catch { /* ignore */ }
          }
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

        api.tex(resolvedAlphaTex);
      } catch (err) {
        if (!destroyed) {
          setError(err instanceof Error ? err.message : "Failed to initialize player");
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      if (apiRef.current) {
        try {
          apiRef.current.stop();
          apiRef.current.destroy();
        } catch { /* ignore */ }
        apiRef.current = null;
      }
    };
  }, [resolvedAlphaTex]);

  // Generate AlphaTex with a specific BPM (overrides the stored tempo)
  const buildAlphaTex = (bpm: number): string | null => {
    if (!currentTab.alphatex) return null;
    if (isTabDataJson(currentTab.alphatex)) {
      const data = parseTabData(currentTab.alphatex);
      if (!data) return null;
      return tabDataToAlphaTex({ ...data, tempo: bpm });
    }
    // Raw AlphaTex: replace the \tempo line with the new BPM
    return currentTab.alphatex.replace(/\\tempo\s+\d+/, `\\tempo ${bpm}`);
  };

  // Reload the score with a new tempo without recreating the API
  const applyBpm = (bpm: number) => {
    if (!apiRef.current || !currentTab.alphatex) return;
    const tex = buildAlphaTex(bpm);
    if (!tex) return;
    try {
      apiRef.current.stop();
      setIsPlaying(false);
      setIsLoading(true);
      apiRef.current.tex(tex);
    } catch { /* ignore */ }
  };

  // Apply a tempo and auto-play once the score reloads
  const playAtBpm = (bpm: number) => {
    if (!apiRef.current) return;
    setPractiseBpm(bpm);
    // If already at this BPM, just restart playback directly
    if (bpm === practiseBpm) {
      try {
        apiRef.current.stop();
        apiRef.current.play();
      } catch { /* ignore */ }
      return;
    }
    pendingAutoPlay.current = true;
    applyBpm(bpm);
  };

  // Capture spacebar so it controls the tab player, not the audio track behind
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        e.stopPropagation();
        handlePlayPause();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  const handlePlayPause = () => {
    if (!apiRef.current) return;
    try {
      if (isPlaying) {
        apiRef.current.pause();
      } else {
        apiRef.current.play();
      }
    } catch { /* ignore */ }
  };

  const handleStop = () => {
    if (!apiRef.current) return;
    try {
      apiRef.current.stop();
    } catch { /* ignore */ }
  };

  const handleToggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (apiRef.current) {
      try { apiRef.current.isLooping = next; } catch { /* ignore */ }
    }
  };

  const handleBpmInput = (value: string) => {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n > 0) {
      setPractiseBpm(Math.max(10, Math.min(400, n)));
    }
  };

  const handleSaveTempo = async () => {
    setIsSaving(true);
    try {
      // Also update the tempo inside the stored alphatex so it reloads correctly next time
      let updatedAlphatex = currentTab.alphatex;
      if (currentTab.alphatex && isTabDataJson(currentTab.alphatex)) {
        const data = parseTabData(currentTab.alphatex);
        if (data) updatedAlphatex = JSON.stringify({ ...data, tempo: practiseBpm });
      } else if (currentTab.alphatex) {
        updatedAlphatex = currentTab.alphatex.replace(/\\tempo\s+\d+/, `\\tempo ${practiseBpm}`);
      }
      await onSave(currentTab.id, { tempo: practiseBpm, alphatex: updatedAlphatex ?? undefined });
      setCurrentTab((prev) => ({
        ...prev,
        tempo: practiseBpm,
        alphatex: updatedAlphatex ?? prev.alphatex,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      const serialized = JSON.stringify(editTabData);
      await onSave(currentTab.id, {
        name: editName.trim(),
        alphatex: serialized,
        tempo: editTabData.tempo,
      });
      setCurrentTab((prev) => ({
        ...prev,
        name: editName.trim(),
        alphatex: serialized,
        tempo: editTabData.tempo,
      }));
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(currentTab.name);
    if (currentTab.alphatex && isTabDataJson(currentTab.alphatex)) {
      setEditTabData(parseTabData(currentTab.alphatex) ?? createDefaultTabData(currentTab.tempo));
    } else {
      setEditTabData(createDefaultTabData(currentTab.tempo));
    }
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-semibold truncate pr-4">{currentTab.name}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
              >
                Edit Tab
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {isEditing ? (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">Tab</label>
                <VisualTabEditor data={editTabData} onChange={setEditTabData} />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editName.trim()}
                  className="px-4 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {!resolvedAlphaTex ? (
                <div className="text-gray-500 text-sm py-8 text-center">
                  No tab notation yet.{" "}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-blue-400 hover:underline"
                  >
                    Click Edit Tab to add some.
                  </button>
                </div>
              ) : (
                <>
                  {isLoading && (
                    <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
                      Loading tab...
                    </div>
                  )}
                  {error && (
                    <div className="text-red-400 text-sm py-2">
                      Error rendering tab: {error}
                    </div>
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
                    .at-cursor-bar {
                      background: rgba(255, 242, 0, 0.25);
                    }
                    .at-beat-cursor {
                      background: rgba(64, 64, 255, 0.75);
                      width: 3px;
                    }
                    .at-selection div {
                      background: rgba(64, 64, 255, 0.1);
                    }
                  `}</style>
                  <div
                    ref={containerRef}
                    style={{
                      width: "100%",
                      background: "#1f2937",
                      borderRadius: "4px",
                      padding: "8px",
                      minHeight: "200px",
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Playback controls */}
        {!isEditing && resolvedAlphaTex && (
          <div className="border-t border-gray-700 px-4 py-3 space-y-2">
            {/* Speed presets */}
            <div className="flex items-center gap-2">
              {([
                { label: "Slow", offset: -15, color: "bg-blue-700 hover:bg-blue-600" },
                { label: "Up to Speed", offset: 0, color: "bg-green-700 hover:bg-green-600" },
                { label: "Fast", offset: 5, color: "bg-orange-700 hover:bg-orange-600" },
              ] as const).map(({ label, offset, color }) => {
                const bpm = Math.max(10, currentTab.tempo + offset);
                const isActive = practiseBpm === bpm;
                return (
                  <button
                    key={label}
                    onClick={() => playAtBpm(bpm)}
                    disabled={isLoading}
                    className={`flex-1 py-2 text-xs font-medium rounded transition-all disabled:opacity-40 ${
                      isActive
                        ? `${color} text-white ring-2 ring-white/40`
                        : `${color} text-white/80`
                    }`}
                  >
                    {label} {bpm}
                  </button>
                );
              })}
            </div>
            {/* Transport controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleStop}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-40"
                title="Stop"
              >
                ■ Stop
              </button>
              <button
                onClick={handlePlayPause}
                disabled={isLoading}
                className="px-4 py-1.5 text-xs rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-40 min-w-18"
              >
                {isPlaying ? "❚❚ Pause" : "▶ Play"}
              </button>
              <button
                onClick={handleToggleLoop}
                title={isLooping ? "Repeat on" : "Repeat off"}
                className={`px-3 py-1.5 text-xs rounded ${
                  isLooping
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-400"
                }`}
              >
                ↺
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  localStorage.setItem("alphatab-volume", String(v));
                  if (apiRef.current) {
                    try { apiRef.current.masterVolume = v; } catch { /* ignore */ }
                  }
                }}
                className="w-16 h-1 accent-gray-400 ml-2"
                title={`Volume ${Math.round(volume * 100)}%`}
              />
              <input
                type="number"
                value={practiseBpm}
                onChange={(e) => handleBpmInput(e.target.value)}
                onBlur={() => applyBpm(practiseBpm)}
                onKeyDown={(e) => { if (e.key === "Enter") applyBpm(practiseBpm); }}
                min={10}
                max={400}
                className="w-16 bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none text-center ml-2"
                title="Tempo — press Enter or click away to apply"
              />
              <span className="text-xs text-gray-500">BPM</span>
              {practiseBpm !== currentTab.tempo && (
                <button
                  onClick={handleSaveTempo}
                  disabled={isSaving}
                  className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50"
                  title="Save this as the tab's tempo"
                >
                  {isSaving ? "Saving..." : "Save tempo"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
