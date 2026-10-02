"use client";

import { useState } from "react";
import type { GpSongSection } from "@/types";
import type { BarRange } from "./useAlphaTabPlayback";

interface GpSectionsPanelProps {
  sections: GpSongSection[];
  activeId: string | null;
  /** A range dragged out on the score that has not been saved yet. */
  draggedRange: BarRange | null;
  onPlay: (section: GpSongSection) => void;
  onSave: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

/** Bars are stored 0-based and shown 1-based; this is the only conversion. */
const label = (range: { startBar: number; endBar: number }) =>
  range.startBar === range.endBar
    ? `bar ${range.startBar + 1}`
    : `bars ${range.startBar + 1}–${range.endBar + 1}`;

/**
 * The sections you drill, saved with the song.
 *
 * Drag a range out on the score, name it, and it is there next time;
 * clicking one jumps to it and loops it.
 */
export default function GpSectionsPanel({
  sections,
  activeId,
  draggedRange,
  onPlay,
  onSave,
  onRename,
  onDelete,
}: GpSectionsPanelProps) {
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  return (
    <div className="flex flex-col gap-2 w-56 shrink-0">
      <h3 className="text-xs uppercase tracking-wide text-gray-400">Sections</h3>

      {draggedRange && (
        <form
          className="flex flex-col gap-1 p-2 rounded bg-gray-800 border border-blue-700"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            setDraft("");
          }}
        >
          <span className="text-xs text-blue-300">Selected {label(draggedRange)}</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Name it, e.g. Solo"
            aria-label="Section name"
            className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-2 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 text-white"
          >
            Save section
          </button>
        </form>
      )}

      {sections.length === 0 && !draggedRange && (
        <p className="text-xs text-gray-500">
          Drag across the score to pick a section, then name it.
        </p>
      )}

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {sections.map((section) => (
          <li key={section.id} className="flex items-center gap-1">
            {renaming === section.id ? (
              <form
                className="flex-1 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  onRename(section.id, renameText);
                  setRenaming(null);
                }}
              >
                <input
                  autoFocus
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  aria-label={`Rename ${section.name}`}
                  onBlur={() => setRenaming(null)}
                  className="flex-1 min-w-0 bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
                />
              </form>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onPlay(section)}
                  title={`Loop ${label(section)}`}
                  className={`flex-1 min-w-0 text-left px-2 py-1 text-xs rounded border ${
                    section.id === activeId
                      ? "bg-blue-900/60 border-blue-700 text-blue-100"
                      : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white"
                  }`}
                >
                  <span className="block truncate">{section.name}</span>
                  <span className="block text-[10px] text-gray-400">{label(section)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(section.id);
                    setRenameText(section.name);
                  }}
                  aria-label={`Rename ${section.name}`}
                  className="px-1 py-1 text-xs text-gray-400 hover:text-white"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(section.id)}
                  aria-label={`Delete ${section.name}`}
                  className="px-1 py-1 text-xs text-gray-400 hover:text-red-400"
                >
                  ✕
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
