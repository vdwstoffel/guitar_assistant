"use client";

import { useState } from "react";
import { MIN_TEMPO, MAX_TEMPO, clampTempo } from "@/lib/tabscore/commands/tempo";

interface TempoControlProps {
  /** The notated tempo, or null when the tab has no \tempo directive. */
  tempo: number | null;
  onChange: (bpm: number) => void;
  disabled?: boolean;
}

/**
 * The score's written tempo — deliberately distinct from the percentage
 * playback speed beside it. Changing this edits the music (and is undoable);
 * changing the speed only scales playback.
 *
 * Renders disabled rather than hidden when `tempo` is null, so a tab whose
 * \tempo directive was deleted shows why the control does nothing.
 */
export default function TempoControl({ tempo, onChange, disabled = false }: TempoControlProps) {
  const [draft, setDraft] = useState("");
  const off = disabled || tempo === null;

  const commit = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) onChange(clampTempo(parsed));
    setDraft("");
  };

  const step = (delta: number) => {
    if (tempo !== null) onChange(clampTempo(tempo + delta));
  };

  return (
    <div
      className="flex items-center gap-1"
      title={
        off
          ? "This tab has no \\tempo directive"
          : "Written tempo in BPM — not the same as playback speed"
      }
    >
      <span className="text-gray-400 text-sm select-none" aria-hidden>♩=</span>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={off}
        aria-label="Decrease tempo"
        className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
      >−</button>
      <input
        type="number"
        min={MIN_TEMPO}
        max={MAX_TEMPO}
        disabled={off}
        aria-label="Tempo in BPM"
        value={draft || (tempo ?? "")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          // Stop the editor's container handler seeing these: digits are fret
          // entry and Backspace clears a note. Typing a tempo must not edit
          // the tab underneath.
          e.stopPropagation();
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-14 px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-center text-xs text-gray-200 focus:outline-none focus:border-blue-500 disabled:opacity-40"
      />
      <button
        type="button"
        onClick={() => step(1)}
        disabled={off}
        aria-label="Increase tempo"
        className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
      >+</button>
      <span className="text-gray-500 text-xs select-none">BPM</span>
    </div>
  );
}
