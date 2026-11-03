"use client";

import ToolbarPopover from "./ToolbarPopover";
import RepeatBarsControl from "./RepeatBarsControl";
import AlternateEndingsControl from "./AlternateEndingsControl";
import TimeSignatureControl from "./TimeSignatureControl";
import type { TimeSignature } from "@/lib/tabscore/commands/timeSignature";

interface BarControlProps {
  /** The bar the caret is in, zero-based — what every control in here edits. */
  barIndex: number;
  repeatStartOn: boolean;
  repeatEndCount: number | null;
  repeatCount: number;
  onRepeatCountChange: (count: number) => void;
  onToggleRepeatStart: () => void;
  onToggleRepeatEnd: () => void;
  endings: number[];
  onToggleEnding: (ending: number) => void;
  timeSignature: TimeSignature | null;
  onTimeSignatureChange: (next: TimeSignature) => void;
  disabled?: boolean;
}

/**
 * Everything written onto the caret's bar — repeat signs, endings and the
 * time signature — behind one button. They are reached for a few times per
 * tab, not per note, and side by side they took over half the writing row.
 *
 * The button names the bar and what is on it (`Bar 5 · 𝄇×2 · 1.`), lit while
 * there is anything, so moving the caret still shows the signs at a glance
 * the way the separate pressed buttons used to.
 */
export default function BarControl({
  barIndex,
  repeatStartOn,
  repeatEndCount,
  repeatCount,
  onRepeatCountChange,
  onToggleRepeatStart,
  onToggleRepeatEnd,
  endings,
  onToggleEnding,
  timeSignature,
  onTimeSignatureChange,
  disabled = false,
}: BarControlProps) {
  const marks = [
    repeatStartOn ? "𝄆" : null,
    repeatEndCount !== null ? `𝄇×${repeatEndCount}` : null,
    endings.length > 0 ? endings.map((n) => `${n}.`).join(" ") : null,
  ].filter(Boolean);

  return (
    <ToolbarPopover
      label={[`Bar ${barIndex + 1}`, ...marks].join(" · ")}
      title={`Repeat signs, endings and time signature for bar ${barIndex + 1}`}
      ariaLabel="Bar settings"
      active={marks.length > 0}
      disabled={disabled}
    >
      <RepeatBarsControl
        barIndex={barIndex}
        startOn={repeatStartOn}
        endCount={repeatEndCount}
        count={repeatCount}
        onCountChange={onRepeatCountChange}
        onToggleStart={onToggleRepeatStart}
        onToggleEnd={onToggleRepeatEnd}
        disabled={disabled}
      />
      <AlternateEndingsControl
        barIndex={barIndex}
        endings={endings}
        onToggle={onToggleEnding}
        disabled={disabled}
      />
      <TimeSignatureControl
        barIndex={barIndex}
        value={timeSignature}
        onChange={onTimeSignatureChange}
        disabled={disabled}
      />
    </ToolbarPopover>
  );
}
