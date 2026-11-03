"use client";

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
  "w-6 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";
const OFF =
  "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white";
const ON = "bg-purple-800 border-purple-600 text-white hover:bg-purple-700";

/**
 * Alternate endings — the "1., 2." / "3." brackets over the bars a repeat
 * plays differently each time, written into the tab as `\ae (1 2)`.
 *
 * The numbers tick on and off for the bar the caret is in, the same way the
 * repeat signs above them work, so a bar can take two ("1., 2."). A two-bar
 * ending is two bars ticked alike: alphaTab joins side-by-side bars with the
 * same numbers into one bracket. All eight numbers are offered — alphaTab's
 * limit, and Guitar Pro's; it lives in the Bar menu, where a row of eight
 * small buttons costs the toolbar nothing.
 */
export default function AlternateEndingsControl({
  barIndex,
  endings,
  onToggle,
  disabled = false,
}: AlternateEndingsControlProps) {
  const bar = `bar ${barIndex + 1}`;

  return (
    <div className="flex flex-col gap-1">
      <div role="group" aria-label="Alternate endings" className="flex items-center gap-1">
        <span className="text-gray-400 text-xs select-none mr-1">Ending</span>
        {Array.from({ length: MAX_ENDING }, (_, i) => i + 1).map((n) => {
          const on = endings.includes(n);
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(n)}
              aria-pressed={on}
              aria-label={`Ending ${n}`}
              title={on ? `Take ending ${n} off ${bar}` : `Play ${bar} on pass ${n} of the repeat`}
              className={`${BUTTON} ${on ? ON : OFF}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="max-w-64 text-[11px] leading-snug text-gray-400">
        Tick every bar of an ending: bars side by side with the same numbers share one bracket.
      </p>
    </div>
  );
}
