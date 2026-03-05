"use client";

import { useState } from "react";
import type { Track, TrackTab } from "@/types";
import type { TabData } from "@/lib/tabData";
import { createDefaultTabData } from "@/lib/tabData";
import AlphaTexPlayer from "./AlphaTexPlayer";
import VisualTabEditor from "./VisualTabEditor";

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

export default function TrackTabsModal({
  track,
  onClose,
  onTabCreate,
  onTabUpdate,
  onTabDelete,
}: TrackTabsModalProps) {
  const [tabs, setTabs] = useState<TrackTab[]>(track.tabs ?? []);
  const [practiceTab, setPracticeTab] = useState<TrackTab | null>(null);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newTabData, setNewTabData] = useState<TabData>(() =>
    createDefaultTabData(track.tempo ?? 120)
  );
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setIsAdding(true);
    try {
      const tab = await onTabCreate(
        track.id,
        newName.trim(),
        JSON.stringify(newTabData),
        newTabData.tempo
      );
      setTabs((prev) => [...prev, tab]);
      setNewName("");
      setNewTabData(createDefaultTabData(track.tempo ?? 120));
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
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

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Tab</label>
                  <VisualTabEditor data={newTabData} onChange={setNewTabData} />
                </div>

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
                      setNewTabData(createDefaultTabData(track.tempo ?? 120));
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

      {/* AlphaTexPlayer opens on top */}
      {practiceTab && (
        <AlphaTexPlayer
          track={track}
          tab={practiceTab}
          onClose={() => setPracticeTab(null)}
          onSave={handleSaveFromPlayer}
        />
      )}
    </>
  );
}
