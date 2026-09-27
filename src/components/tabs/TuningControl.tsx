"use client";

import { TUNING_PRESETS } from "@/lib/tabscore/commands/tuning";

interface TuningControlProps {
  /**
   * The current preset's id, or null for a tuning the preset list does not
   * name — a hand-written `\tuning` in the source pane, most likely.
   */
  tuningId: string | null;
  onChange: (presetId: string) => void;
  disabled?: boolean;
}

const CUSTOM = "__custom";

/**
 * The score's tuning. Like the tempo beside it this edits the document (a
 * `\tuning` directive) rather than a playback setting, so it is undoable and
 * saved with the tab.
 *
 * A tuning outside the preset list shows as "Custom" and stays selectable
 * only in the sense that it is the current value — picking any preset
 * replaces it. The list is six-string only; see tuning.ts for why.
 */
export default function TuningControl({ tuningId, onChange, disabled = false }: TuningControlProps) {
  const value = tuningId ?? CUSTOM;

  return (
    <label
      className="flex items-center gap-1"
      title="The score's tuning — written into the tab, not a playback setting"
    >
      <span className="text-gray-400 text-xs select-none">Tuning</span>
      <select
        value={value}
        disabled={disabled}
        aria-label="Tuning"
        onChange={(e) => {
          if (e.target.value !== CUSTOM) onChange(e.target.value);
        }}
        className="bg-gray-700 text-gray-200 text-xs rounded px-1 py-1 border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {tuningId === null && (
          <option value={CUSTOM}>Custom</option>
        )}
        {TUNING_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
    </label>
  );
}
