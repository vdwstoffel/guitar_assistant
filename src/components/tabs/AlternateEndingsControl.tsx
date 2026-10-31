"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_ENDING } from "@/lib/tabscore/commands/endings";

interface AlternateEndingsControlProps {
  /** The bar the caret is in, zero-based — the bar a number goes on. */
  barIndex: number;
  /** The ending numbers that bar's bracket carries, from 1; empty for none. */
  endings: number[];
  onToggle: (ending: number) => void;
  disabled?: boolean;
}

const BUTTON =
  "px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";
const OFF =
  "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white";
const ON = "bg-purple-800 border-purple-600 text-white hover:bg-purple-700";

/**
 * Alternate endings — the "1., 2." / "3." brackets over the bars a repeat
 * plays differently each time, written into the tab as `\ae (1 2)`.
 *
 * The numbers tick on and off for the bar the caret is in, the same way the
 * repeat signs beside it work, and the list stays open so a bar can take two
 * ("1., 2.") in one go. A two-bar ending is two bars ticked alike: alphaTab
 * joins side-by-side bars with the same numbers into one bracket.
 *
 * Folded behind one button like the techniques: all eight numbers — alphaTab's
 * limit, and Guitar Pro's — are offered, and eight buttons cost the writing
 * row more than the control is worth.
 */
export default function AlternateEndingsControl({
  barIndex,
  endings,
  onToggle,
  disabled = false,
}: AlternateEndingsControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const bar = `bar ${barIndex + 1}`;
  const marked = endings.length > 0;

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
    <div ref={rootRef} role="group" aria-label="Alternate endings" className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        title={marked ? `${bar} is part of ending ${endings.join(" and ")}` : `Make ${bar} part of an alternate ending`}
        className={`${BUTTON} ${marked ? ON : OFF}`}
      >
        Ending{marked && ` ${endings.map((n) => `${n}.`).join(" ")}`} ▾
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full mt-1 z-30 w-48 flex flex-col p-1 rounded border border-gray-500 bg-gray-700 shadow-lg">
          {Array.from({ length: MAX_ENDING }, (_, i) => i + 1).map((n) => {
            const on = endings.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => onToggle(n)}
                aria-pressed={on}
                aria-label={`Ending ${n}`}
                title={on ? `Take ending ${n} off ${bar}` : `Play ${bar} on pass ${n} of the repeat`}
                className="flex items-center gap-2 px-2 py-1 text-xs text-left rounded text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:bg-gray-500"
              >
                <span className={`w-3 text-center ${on ? "text-purple-300" : "text-transparent"}`} aria-hidden>
                  ✓
                </span>
                Ending {n}.
              </button>
            );
          })}
          <p className="px-2 pt-1 mt-1 border-t border-gray-600 text-[11px] leading-snug text-gray-400">
            Tick every bar of an ending: bars side by side with the same numbers share one bracket.
          </p>
        </div>
      )}
    </div>
  );
}
