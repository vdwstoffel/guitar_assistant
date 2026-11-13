"use client";

import { useState } from "react";
import TapButton from "./TapButton";
import { SESSION_TIME_SIGNATURES, type SessionPrefs } from "@/lib/songwriting/sessionPrefs";
import { MAX_TEMPO, MIN_TEMPO } from "@/lib/tabscore/commands/tempo";

type ClickPrefs = Pick<SessionPrefs, "clickTempo" | "tsNum" | "tsDen" | "click">;

const LABEL = "flex flex-col gap-1 text-[11px] uppercase tracking-wide text-gray-400";
const FIELD = "bg-gray-700 text-gray-100 text-sm rounded-lg px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-amber-500";

/** The tempo to record to (tapped or typed), its time signature, and whether to count in and click. */
export default function ClickSettings({ prefs, onChange }: { prefs: ClickPrefs; onChange(patch: Partial<ClickPrefs>): void }) {
  // A typed tempo counts on blur or Enter: on the way to "140" the box holds "14", a valid tempo.
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null); // an empty or out-of-range draft reverts
    if (draft.trim() !== "" && Number.isInteger(n) && n >= MIN_TEMPO && n <= MAX_TEMPO) onChange({ clickTempo: n });
  };
  const tsIndex = SESSION_TIME_SIGNATURES.findIndex(([n, d]) => n === prefs.tsNum && d === prefs.tsDen);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className={LABEL}>
          Tempo
          <span className="flex items-center gap-1.5 normal-case tracking-normal">
            <input
              type="number"
              aria-label="Tempo to record to (BPM)"
              min={MIN_TEMPO}
              max={MAX_TEMPO}
              value={draft ?? prefs.clickTempo ?? ""}
              placeholder="—"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") setDraft(null);
              }}
              className={`${FIELD} w-16 text-center`}
            />
            <span className="text-xs text-gray-500">BPM</span>
          </span>
        </label>
        <TapButton onTempo={(clickTempo) => onChange({ clickTempo })} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          <span className="sr-only">Time signature</span>
          <select
            aria-label="Time signature"
            value={tsIndex < 0 ? 0 : tsIndex}
            onChange={(e) => {
              const [tsNum, tsDen] = SESSION_TIME_SIGNATURES[Number(e.target.value)];
              onChange({ tsNum, tsDen });
            }}
            className={`${FIELD} py-1`}
          >
            {SESSION_TIME_SIGNATURES.map(([n, d], i) => (
              <option key={i} value={i}>{n}/{d}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer" title="Count in one bar, then click on every beat while recording">
          <input type="checkbox" checked={prefs.click} onChange={(e) => onChange({ click: e.target.checked })} className="accent-amber-500" />
          Click
        </label>
      </div>
    </div>
  );
}
