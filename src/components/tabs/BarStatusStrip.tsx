"use client";

import type { StripMessage } from "@/lib/tabscore/barMessages";

interface BarStatusStripProps {
  message: StripMessage;
  onFixAll?: () => void;
}

/**
 * The line under the score while some bar does not add up: what is wrong with
 * the caret's bar, or which bars are, and Fix all. Styled like ScoreCanvas's
 * error strip, in amber; it wraps in a narrow dock. A click on Fix all never
 * takes focus (mouse-down is prevented), so Space and Enter keep going to the
 * editor; reached with Tab, it shows the browser's focus ring like any button.
 *
 * A note, not a live region: its sentence follows the caret from bar to bar,
 * so as a `status` region a screen reader would read it out at every arrow
 * key. What a bar command did or refused is already spoken by TabEditor's
 * notice, which is a status region and changes only when a command runs.
 */
export default function BarStatusStrip({ message, onFixAll }: BarStatusStripProps) {
  return (
    <div
      role="note"
      aria-label="Bar check"
      className="bg-gray-900/90 text-amber-400 text-xs px-2 py-1 border-t border-gray-500"
    >
      {message.text}
      {message.fixAll && onFixAll && (
        <>
          {" · "}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            // Reached with Tab, Enter is this button's (a click), not the note menu's.
            // Ctrl/Cmd+Enter is not: it still reaches the editor, which adds a bar.
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) e.stopPropagation();
            }}
            onClick={onFixAll}
            className="font-semibold underline text-amber-300 hover:text-amber-200"
          >
            Fix all
          </button>
        </>
      )}
    </div>
  );
}
