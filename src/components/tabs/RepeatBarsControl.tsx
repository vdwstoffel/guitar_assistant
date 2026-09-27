"use client";

import { MIN_REPEAT_COUNT, MAX_REPEAT_COUNT, clampRepeatCount } from "@/lib/tabscore/commands/repeat";

interface RepeatBarsControlProps {
  /** The bar the caret is in, zero-based — where a sign would go. */
  barIndex: number;
  /** That bar already opens a repeated section. */
  startOn: boolean;
  /** That bar already closes one, played this many times; null if it does not. */
  endCount: number | null;
  /** The count the end button would write. */
  count: number;
  onCountChange: (count: number) => void;
  onToggleStart: () => void;
  onToggleEnd: () => void;
  disabled?: boolean;
}

const BASE =
  "px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";
const OFF =
  "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white";
const ON = "bg-purple-800 border-purple-600 text-white hover:bg-purple-700";

/**
 * Repeat barlines — the notation, written into the tab as `\ro` / `\rc N`.
 *
 * Start and end are two separate buttons acting on the bar the caret is in,
 * because that is how the signs work: they mark two bars, and everything
 * between them is implied. Nothing has to be selected in between.
 *
 * Deliberately distinct from the ⟳ Repeat transport toggle and the drag-
 * selected practice section, which both only affect playback. This one
 * changes the music: the score draws `𝄆 … 𝄇` and alphaTab plays the section
 * that many times, for anyone reading the tab afterwards.
 */
export default function RepeatBarsControl({
  barIndex,
  startOn,
  endCount,
  count,
  onCountChange,
  onToggleStart,
  onToggleEnd,
  disabled = false,
}: RepeatBarsControlProps) {
  const bar = `bar ${barIndex + 1}`;
  const endOn = endCount !== null;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggleStart}
        aria-pressed={startOn}
        aria-label="Repeat start"
        title={
          startOn
            ? `Remove the repeat-start sign from ${bar}`
            : `Start a repeated section at ${bar}`
        }
        className={`${BASE} ${startOn ? ON : OFF}`}
      >
        𝄆 Repeat start
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggleEnd}
        aria-pressed={endOn}
        aria-label="Repeat end"
        title={
          endCount === count
            ? `Remove the repeat-end sign from ${bar}`
            : `End the repeated section at ${bar}, played ${count} times`
        }
        className={`${BASE} ${endOn ? ON : OFF}`}
      >
        𝄇 Repeat end
      </button>
      <span className="text-gray-400 text-xs select-none" aria-hidden>×</span>
      <input
        type="number"
        min={MIN_REPEAT_COUNT}
        max={MAX_REPEAT_COUNT}
        value={count}
        disabled={disabled}
        aria-label="Times to repeat"
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          if (!isNaN(parsed)) onCountChange(clampRepeatCount(parsed));
        }}
        className="w-12 bg-gray-700 text-gray-200 text-xs rounded px-1 py-1 border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-40"
      />
    </div>
  );
}
