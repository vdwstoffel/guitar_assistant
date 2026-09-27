"use client";

import { useState, useEffect } from "react";
import type { Track, TrackTab } from "@/types";
import TabEditor from "./tabs/TabEditor";
import { emptyTabTex } from "@/lib/tabscore/emptyTab";

// A minimal but valid AlphaTex document for a freshly-created tab: a tempo
// header, the track separator, and one bar of rests. parseTex (see
// @/lib/tabscore/parse) rejects an empty string outright, so a brand new tab
// needs something parseable rather than nothing at all. Actual notation is
// then written in via the canvas tab editor (the Tabs section), which
// replaced the old inline VisualTabEditor/TabData grid this modal used to embed.

interface TrackTabsModalProps {
  track: Track;
  onClose: () => void;
  onTabCreate: (
    trackId: string,
    name: string,
    alphatex: string | null,
    tempo: number
  ) => Promise<TrackTab>;
  onTabUpdate: (tabId: string, updates: Partial<TrackTab>) => Promise<void>;
  onTabDelete: (tabId: string) => Promise<void>;
}

// Where the editor sits relative to the page behind it. Tabs are written
// WHILE reading the book they come from, so the editor must not cover the
// PDF: the lessons page puts the track list on the left and the PDF on the
// right, which makes "left" the default that leaves the music visible.
type Dock = "left" | "right" | "full";
const DOCK_KEY = "tabEditorDock";
const WIDTH_KEY = "tabEditorDockWidth";

// Narrow enough that the toolbar still fits on a few rows, and never so wide
// that the PDF it exists to sit beside is squeezed out.
const MIN_WIDTH = 460;
const MIN_REMAINDER = 340;

function clampWidth(px: number): number {
  const max = Math.max(MIN_WIDTH, window.innerWidth - MIN_REMAINDER);
  return Math.min(max, Math.max(MIN_WIDTH, Math.round(px)));
}

function loadDock(): Dock {
  try {
    const stored = localStorage.getItem(DOCK_KEY);
    if (stored === "left" || stored === "right" || stored === "full") return stored;
  } catch {
    // Private windows and blocked site data both throw here; the default is
    // perfectly usable, so there is nothing to report.
  }
  return "left";
}

// A fraction of the page rather than a fixed split: the lessons page itself
// gives the PDF either half or two thirds depending on its fit mode, so no
// one constant leaves the music visible in both. The edge is draggable for
// the same reason.
function loadWidth(): number {
  try {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) return clampWidth(stored);
  } catch {
    /* fall through to the default */
  }
  return clampWidth(window.innerWidth * 0.45);
}

export default function TrackTabsModal({
  track,
  onClose,
  onTabCreate,
  onTabUpdate,
  onTabDelete,
}: TrackTabsModalProps) {
  const [tabs, setTabs] = useState<TrackTab[]>(track.tabs ?? []);
  const [practiceTab, setPracticeTab] = useState<TrackTab | null>(null);
  // Read on mount rather than in the initialiser: this component renders on
  // the server too, where localStorage does not exist.
  const [dock, setDock] = useState<Dock>("left");
  const [dockWidth, setDockWidth] = useState(640);
  useEffect(() => {
    setDock(loadDock());
    setDockWidth(loadWidth());
  }, []);

  const chooseDock = (next: Dock) => {
    setDock(next);
    try {
      localStorage.setItem(DOCK_KEY, next);
    } catch {
      /* the choice just will not survive a reload */
    }
  };

  // Drag the panel's inner edge to resize. Pointer capture rather than
  // window listeners, so the drag survives the cursor crossing the PDF
  // (or leaving the window) mid-gesture.
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const side = dock;

    const onMove = (ev: PointerEvent) => {
      setDockWidth(clampWidth(side === "left" ? ev.clientX : window.innerWidth - ev.clientX));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setDockWidth((w) => {
        try {
          localStorage.setItem(WIDTH_KEY, String(w));
        } catch {
          /* the width just will not survive a reload */
        }
        return w;
      });
      // alphaTab lays the score out on window resize, not container resize,
      // so without this the staff keeps the width it was rendered at and
      // the SVG simply stretches to fit.
      window.dispatchEvent(new Event("resize"));
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  // Add form state
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setIsAdding(true);
    try {
      const tempo = track.tempo ?? 120;
      const tab = await onTabCreate(track.id, newName.trim(), emptyTabTex(tempo), tempo);
      setTabs((prev) => [...prev, tab]);
      setNewName("");
      setShowAddForm(false);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (tabId: string) => {
    await onTabDelete(tabId);
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
  };

  const handleSaveFromPlayer = async (tabId: string, updates: Partial<TrackTab>) => {
    await onTabUpdate(tabId, updates);
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t)));
    if (practiceTab?.id === tabId) {
      setPracticeTab((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  };

  return (
    <>
      {/* Hidden rather than unmounted while the editor is open, so the list's
          own state survives closing the editor. */}
      <div
        className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${
          practiceTab ? "hidden" : ""
        }`}
        onClick={onClose}
      >
        <div className="bg-gray-800 rounded-xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
            <h2 className="text-white font-semibold">
              Guitar Tabs
              <span className="text-gray-400 font-normal text-sm ml-2">
                — {track.title}
              </span>
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Tab list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {tabs.length === 0 && !showAddForm && (
              <div className="text-gray-500 text-sm text-center py-6">
                No tabs yet. Add one below.
              </div>
            )}
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{tab.name}</div>
                  <div className="text-gray-400 text-xs">{tab.tempo} BPM</div>
                </div>
                <button
                  onClick={() => setPracticeTab(tab)}
                  className="px-3 py-1 text-xs rounded bg-green-700 hover:bg-green-600 text-white shrink-0"
                >
                  Practice
                </button>
                <button
                  onClick={() => handleDelete(tab.id)}
                  className="px-2 py-1 text-xs rounded bg-gray-600 hover:bg-red-700 text-gray-300 hover:text-white shrink-0"
                  title="Delete tab"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add form */}
            {showAddForm && (
              <div className="bg-gray-700 rounded-lg p-4 space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tab name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Tricky lick bar 12"
                    className="w-full bg-gray-600 text-white text-sm rounded px-3 py-2 border border-gray-500 focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <p className="text-xs text-gray-500">
                  This creates an empty tab. Write the actual notation for it in the Tabs section.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={isAdding || !newName.trim()}
                    className="px-4 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                  >
                    {isAdding ? "Adding..." : "Add Tab"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewName("");
                    }}
                    className="px-4 py-1.5 text-sm rounded bg-gray-600 hover:bg-gray-500 text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!showAddForm && (
            <div className="px-4 py-3 border-t border-gray-700 shrink-0">
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-300 border border-dashed border-gray-600"
              >
                + Add Tab
              </button>
            </div>
          )}
        </div>
      </div>

      {/*
        A docked panel, not a centred dialog over a dimmed page: a tab is
        written while reading the book it comes from, and a full-screen
        overlay hid exactly the music being transcribed. Nothing dims, and
        there is no click-outside-to-close, so the PDF beside it stays
        readable AND scrollable while typing.
      */}
      {practiceTab && (
        <div
          className={`fixed inset-y-0 z-60 flex flex-col bg-gray-800 shadow-2xl ${
            dock === "full"
              ? "inset-x-0"
              : dock === "left"
                ? "left-0 border-r border-gray-600"
                : "right-0 border-l border-gray-600"
          }`}
          style={dock === "full" ? undefined : { width: dockWidth }}
        >
          {dock !== "full" && (
            <div
              onPointerDown={startResize}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the editor"
              className={`absolute inset-y-0 w-1.5 cursor-col-resize bg-transparent hover:bg-blue-500/50 ${
                dock === "left" ? "right-0" : "left-0"
              }`}
            />
          )}
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-700 shrink-0">
              <h2 className="text-white font-semibold truncate min-w-0">
                {practiceTab.name}
                <span className="ml-2 text-xs font-normal text-gray-400">{track.title}</span>
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                {(
                  [
                    ["left", "⇤", "Dock left (keeps the PDF visible)"],
                    ["full", "⤢", "Use the whole window"],
                    ["right", "⇥", "Dock right"],
                  ] as const
                ).map(([value, glyph, title]) => (
                  <button
                    key={value}
                    onClick={() => chooseDock(value)}
                    title={title}
                    aria-label={title}
                    aria-pressed={dock === value}
                    className={`px-2 py-1 text-xs rounded border ${
                      dock === value
                        ? "bg-gray-500 border-gray-400 text-white"
                        : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white"
                    }`}
                  >
                    {glyph}
                  </button>
                ))}
                <button
                  onClick={() => setPracticeTab(null)}
                  className="ml-1 px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <TabEditor
                // Remounts when the panel is re-docked, so alphaTab measures
                // the new width instead of keeping the old one's layout.
                key={`${practiceTab.id}:${dock}`}
                initialTex={
                  practiceTab.alphatex && practiceTab.alphatex.trim() !== ""
                    ? practiceTab.alphatex
                    : emptyTabTex(track.tempo ?? 120)
                }
                initialSpeed={practiceTab.playbackSpeed}
                // Opened from a song, so playing here counts toward the
                // track's practice metrics.
                track={track}
                // Practice first: the source pane is one click away.
                initialShowSource={false}
                onSave={(patch) => handleSaveFromPlayer(practiceTab.id, patch)}
              />
            </div>
        </div>
      )}
    </>
  );
}
