"use client";

import { GUITAR_PRESETS } from "@/lib/tabscore/commands/instrument";

interface GuitarControlProps {
  /**
   * The current preset's id, or null for an instrument the preset list does
   * not name — a hand-written `\instrument` in the source pane, most likely.
   */
  guitarId: string | null;
  onChange: (presetId: string) => void;
  disabled?: boolean;
}

const OTHER = "__other";

/**
 * Which guitar the tab plays as. Like the tuning beside it this edits the
 * document (an `\instrument` directive), so it is undoable and saved with the
 * tab — unlike the Sound picker, which is a playback preference shared by
 * every tab and decides which sample set this guitar is drawn from.
 */
export default function GuitarControl({ guitarId, onChange, disabled = false }: GuitarControlProps) {
  const value = guitarId ?? OTHER;

  return (
    <label
      className="flex items-center gap-1"
      title="The guitar this tab plays as — written into the tab, so each tab keeps its own"
    >
      <span className="text-gray-400 text-xs select-none">Guitar</span>
      <select
        value={value}
        disabled={disabled}
        aria-label="Guitar"
        onChange={(e) => {
          if (e.target.value !== OTHER) onChange(e.target.value);
        }}
        className="bg-gray-700 text-gray-200 text-xs rounded px-1 py-1 border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {guitarId === null && (
          <option value={OTHER}>Other</option>
        )}
        {GUITAR_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
    </label>
  );
}
