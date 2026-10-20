"use client";

import { useEffect, useRef, useState } from "react";
import { TECHNIQUE_KEYS, TECHNIQUE_LABEL, TECHNIQUES, type Technique } from "@/lib/tabscore/commands/technique";

export interface TechniquePaletteProps {
  /**
   * Disables every button. The caller derives this from `parseTex(tex).ok`
   * and passes it down — shared with the same parse result TabEditor's
   * keyboard guard and SourcePane's diagnostics already use, rather than
   * this component calling `parseTex` again on the same text (see
   * task-14-report.md, "Performance note").
   */
  disabled: boolean;
  onSelect: (technique: Technique) => void;
}

// TECHNIQUE_KEYS maps key -> Technique; inverted once at module scope so
// each button can look its own shortcut up in O(1). A technique with no
// keyboard shortcut (bendHalf, bendRelease, preBend — TECHNIQUE_KEYS binds
// only "b" -> bendFull for the whole bend family) just gets no suffix.
const KEY_BY_TECHNIQUE: Partial<Record<Technique, string>> = {};
for (const [key, technique] of Object.entries(TECHNIQUE_KEYS)) {
  KEY_BY_TECHNIQUE[technique] = key;
}

/**
 * Folded behind one button: the 13 techniques took ~1050px of the writing row,
 * and they are mostly reached by their keyboard shortcut (shown in the list)
 * rather than by mouse.
 */
export default function TechniquePalette({ disabled, onSelect }: TechniquePaletteProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} role="toolbar" aria-label="Techniques" className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Techniques"
        className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
      >
        Techniques ▾
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-40 flex flex-col p-1 rounded border border-gray-500 bg-gray-700 shadow-lg">
          {TECHNIQUES.map((technique) => {
            const shortcut = KEY_BY_TECHNIQUE[technique];
            const label = TECHNIQUE_LABEL[technique];
            return (
              <button
                key={technique}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(technique);
                }}
                title={shortcut ? `${label} (${shortcut})` : label}
                className="flex items-center justify-between gap-4 px-2 py-1 text-xs text-left rounded text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:bg-gray-500"
              >
                {label}
                {shortcut && <span className="text-gray-500">{shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
