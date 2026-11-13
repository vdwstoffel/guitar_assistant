"use client";

import { useEffect, useRef } from "react";
import { caretHints } from "@/lib/songwriting/caretHint";
import { chordIndexAtBar, chordName, type ProgressionChord } from "@/lib/songwriting/theory";
import type { BeatNote } from "@/lib/tabscore/caretBeat";

export interface HintStripProps {
  /** The riff's chords; they loop over the tab's bars. */
  progression: ProgressionChord[];
  /** How many bars the riff is: at least this many chips, more when the caret is past them. */
  bars: number;
  /** The caret's bar, 0-based; null before the editor has reported one. */
  caretBar: number | null;
  /** The notes at the caret (lowest first is not assumed). */
  notes: BeatNote[];
  keyRoot: string;
  scale: string;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Above a riff's tab: the chord over each bar, the caret's bar lit, and how
 * the note(s) at the caret sound over that bar's chord — one line per note,
 * lowest first — and whether each is in the riff's scale.
 */
export default function HintStrip({ progression, bars, caretBar, notes, keyRoot, scale }: HintStripProps) {
  const shown = Math.max(bars, caretBar === null ? 0 : caretBar + 1, 1);
  const chordAt = (bar: number): ProgressionChord | null => {
    const i = chordIndexAtBar(progression, bar);
    return i === null ? null : progression[i];
  };
  const chord = caretBar === null ? null : chordAt(caretBar);
  const hints = caretHints({ midis: notes.map((n) => n.midi), chord, keyRoot, scale });
  const keyName = `${keyRoot} ${scale}`;

  // Keep the caret's chip in view in a long riff, scrolling only the row.
  const chipsRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = chipsRef.current;
    const chip = caretBar === null ? null : (list?.children[caretBar] as HTMLElement | undefined);
    if (!list || !chip) return;
    if (chip.offsetLeft < list.scrollLeft) list.scrollLeft = chip.offsetLeft;
    else if (chip.offsetLeft + chip.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = chip.offsetLeft + chip.offsetWidth - list.clientWidth;
    }
  }, [caretBar, shown]);

  return (
    <section aria-label="Hints" className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-gray-400">Chords</span>
        {progression.length === 0 ? (
          <span className="text-xs text-gray-400">
            None — recorded without a progression, so notes are measured from the key, {keyRoot}.
          </span>
        ) : (
          <ol ref={chipsRef} aria-label="The chord over each bar" className="relative flex min-w-0 gap-1 overflow-x-auto">
            {Array.from({ length: shown }, (_, bar) => {
              const c = chordAt(bar);
              const here = bar === caretBar;
              return (
                <li
                  key={bar}
                  aria-current={here ? "true" : undefined}
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-xs ${
                    here ? "border-amber-500 bg-amber-900 text-amber-100" : "border-gray-600 bg-gray-700 text-gray-200"
                  }`}
                >
                  <span className={`mr-1 text-[10px] ${here ? "text-amber-300" : "text-gray-400"}`}>
                    <span className="sr-only">Bar </span>
                    {bar + 1}
                    <span className="sr-only">: </span>
                  </span>
                  <b className="font-semibold">{c ? chordName(c) : "–"}</b>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <ul aria-live="polite" className={`mt-1.5 text-sm leading-5 ${hints.length > 3 ? "md:grid md:grid-cols-2 md:gap-x-6" : ""}`}>
        {notes.length === 0 ? (
          <li className="text-gray-400">
            {hints[0].title} — {lowerFirst(hints[0].detail)}
          </li>
        ) : (
          hints.map((h, i) => (
            <li key={i}>
              <b className="font-semibold text-gray-100">{h.title}</b>
              {h.detail && <span className="text-gray-300"> — {lowerFirst(h.detail)}</span>}
              {h.inScale !== null && " "}
              {h.inScale !== null && (
                <span
                  className={`ml-1 whitespace-nowrap rounded px-1.5 py-px text-[11px] ${
                    h.inScale ? "bg-gray-700 text-gray-300" : "border border-amber-800 bg-amber-950 text-amber-300"
                  }`}
                >
                  {h.inScale ? `in ${keyName}` : `outside ${keyName}`}
                </span>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
