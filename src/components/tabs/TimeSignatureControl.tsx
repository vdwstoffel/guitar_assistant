"use client";

import { TIME_SIGNATURE_PRESETS, type TimeSignature } from "@/lib/tabscore/commands/timeSignature";

interface TimeSignatureControlProps {
  /** The bar the caret is in, zero-based — where a change would go. */
  barIndex: number;
  /** The time signature that bar is in, or null when the tab does not parse. */
  value: TimeSignature | null;
  onChange: (next: TimeSignature) => void;
  disabled?: boolean;
}

const key = ({ numerator, denominator }: TimeSignature) => `${numerator}/${denominator}`;

/**
 * The time signature of the bar the caret is in — written into the tab as
 * `\ts (n d)`, so like the repeat signs beside it this edits the music and is
 * undoable. Picking one changes the metre from that bar on, until the next
 * bar that changes it; to change a single bar, set the bar after it back.
 *
 * A metre outside the preset list (a hand-written `\ts 11 8`) is shown as
 * itself rather than as a stand-in, so the control never misreports the bar.
 */
export default function TimeSignatureControl({
  barIndex,
  value,
  onChange,
  disabled = false,
}: TimeSignatureControlProps) {
  const current = value ? key(value) : "";
  const listed = TIME_SIGNATURE_PRESETS.some((preset) => key(preset) === current);

  return (
    <label
      className="flex items-center gap-1"
      title={`Time signature from bar ${barIndex + 1} on, until the next change — written into the tab`}
    >
      <span className="text-gray-400 text-xs select-none">Time</span>
      <select
        value={current}
        disabled={disabled || value === null}
        aria-label="Time signature"
        onChange={(e) => {
          const preset = TIME_SIGNATURE_PRESETS.find((p) => key(p) === e.target.value);
          if (preset) onChange(preset);
        }}
        className="bg-gray-700 text-gray-200 text-xs rounded px-1 py-1 border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {!listed && <option value={current}>{current}</option>}
        {TIME_SIGNATURE_PRESETS.map((preset) => (
          <option key={key(preset)} value={key(preset)}>
            {key(preset)}
          </option>
        ))}
      </select>
    </label>
  );
}
