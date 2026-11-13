"use client";

import { useMemo } from "react";
import { getNoteIndex, getNoteName } from "@/lib/musicTheory";
import { INTERVAL_LABELS, intervalFeel, scalePitchClasses } from "@/lib/songwriting/theory";

interface IntervalLegendProps {
  referenceRoot: string;
  scale: string;
  keyRoot: string;
  chordPcs: number[];
}

/** One entry per interval in play on the neck: its label, note and how it sounds. */
export default function IntervalLegend({ referenceRoot, scale, keyRoot, chordPcs }: IntervalLegendProps) {
  const entries = useMemo(() => {
    const ref = getNoteIndex(referenceRoot);
    const pcs = new Set([...scalePitchClasses(keyRoot, scale), ...chordPcs]);
    return [...pcs]
      .map((pc) => ({ pc, semis: (((pc - ref) % 12) + 12) % 12 }))
      .sort((a, b) => a.semis - b.semis);
  }, [referenceRoot, scale, keyRoot, chordPcs]);

  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {entries.map(({ pc, semis }) => {
        const chordTone = chordPcs.includes(pc);
        return (
          <li key={pc} className="text-gray-300">
            <b className={`inline-block min-w-7 text-center rounded-md px-1.5 mr-1 ${chordTone ? "bg-amber-500 text-gray-900" : "bg-gray-700 text-gray-100"}`}>
              {INTERVAL_LABELS[semis]}
            </b>
            {getNoteName(pc)} <span className="text-gray-400">— {intervalFeel(semis)}</span>
            {chordTone && <span className="sr-only"> (chord tone)</span>}
          </li>
        );
      })}
    </ul>
  );
}
