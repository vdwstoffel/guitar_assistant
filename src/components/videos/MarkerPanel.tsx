"use client";

import { useState } from "react";
import { formatDurationLong } from "@/lib/formatting";

interface VideoMarker { id: string; name: string; timestamp: number; videoId: string; }

interface MarkerPanelProps {
  markers: VideoMarker[];
  currentTime: number;
  leadIn: number;
  onLeadInChange: (n: number) => void;
  onJumpToMarker: (m: VideoMarker) => void;
  onRenameMarker: (id: string, name: string) => void;
  onDeleteMarker: (id: string) => void;
  loopA: number | null;
  loopB: number | null;
  onSetLoopA: (t: number) => void;
  onSetLoopB: (t: number) => void;
}

export default function MarkerPanel({
  markers, currentTime, leadIn, onLeadInChange, onJumpToMarker,
  onRenameMarker, onDeleteMarker, loopA, loopB, onSetLoopA, onSetLoopB,
}: MarkerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const sorted = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  // The marker whose section is currently playing: the last one at/before the playhead.
  const activeId = sorted.reduce<string | null>(
    (acc, m) => (m.timestamp <= currentTime ? m.id : acc),
    null,
  );

  const commitRename = (id: string) => {
    if (editName.trim()) onRenameMarker(id, editName.trim());
    setEditingId(null);
    setEditName("");
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-sm font-semibold text-gray-300">Markers</h3>
        <div className="flex items-center gap-1 ml-auto">
          <label className="text-xs text-gray-400">Lead-in</label>
          <input
            type="number" min={0} max={30} value={leadIn}
            onChange={(e) => onLeadInChange(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-12 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-center text-white focus:outline-none focus:border-green-500"
            title="Seconds to seek back when jumping to a marker"
          />
          <span className="text-xs text-gray-500">sec</span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-500">No markers yet. Play the video and press M (or ＋ Marker).</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sorted.map((marker) => {
            const isEditing = editingId === marker.id;
            const isA = loopA === marker.timestamp;
            const isB = loopB === marker.timestamp;
            const isActive = marker.id === activeId;
            return (
              <div
                key={marker.id}
                className={`group flex items-center gap-1 bg-gray-800 hover:bg-gray-700 rounded px-2 py-1 border ${
                  isActive ? "border-green-500 ring-1 ring-green-500/40" : "border-gray-700"
                }`}
              >
              {isEditing ? (
                <input
                  type="text" value={editName} autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(marker.id);
                    if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                  }}
                  onBlur={() => commitRename(marker.id)}
                  className="w-32 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-green-500"
                />
              ) : (
                <button
                  onClick={() => onJumpToMarker(marker)}
                  className="flex items-center gap-2 text-left text-xs"
                  title="Jump to marker"
                >
                  <span className="text-green-400 font-mono">{formatDurationLong(marker.timestamp)}</span>
                  <span className="text-gray-300 truncate max-w-40">{marker.name}</span>
                </button>
              )}
              {!isEditing && (
                <>
                  <button
                    onClick={() => onSetLoopA(marker.timestamp)}
                    className={`px-1 rounded border text-[10px] font-bold transition-opacity ${
                      isA
                        ? "bg-amber-600 border-amber-600 text-white"
                        : "border-gray-600 text-gray-400 hover:border-amber-400 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                    }`}
                    title="Set as loop start (A)"
                  >A</button>
                  <button
                    onClick={() => onSetLoopB(marker.timestamp)}
                    className={`px-1 rounded border text-[10px] font-bold transition-opacity ${
                      isB
                        ? "bg-amber-600 border-amber-600 text-white"
                        : "border-gray-600 text-gray-400 hover:border-amber-400 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                    }`}
                    title="Set as loop end (B)"
                  >B</button>
                  <button
                    onClick={() => { setEditingId(marker.id); setEditName(marker.name); }}
                    className="text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100"
                    title="Rename"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button
                    onClick={() => onDeleteMarker(marker.id)}
                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </>
              )}
              </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
