"use client";

import { useMemo } from "react";
import { fretboardCells } from "@/lib/songwriting/theory";
import { tuningMidi } from "@/lib/songwriting/tunings";

interface SongFretboardProps {
  tuning: string;
  keyRoot: string;
  scale: string;
  referenceRoot: string;
  chordPcs: number[];
  labelMode: "intervals" | "notes";
}

const FRETS = 15;

/** Scale notes on the neck, with the chord tones lit; highest string on top as in tab. */
export default function SongFretboard({ tuning, keyRoot, scale, referenceRoot, chordPcs, labelMode }: SongFretboardProps) {
  const cells = useMemo(
    () => fretboardCells({ tuning: tuningMidi(tuning), keyRoot, scale, referenceRoot, chordPcs, frets: FRETS }),
    [tuning, keyRoot, scale, referenceRoot, chordPcs],
  );
  const strings = tuningMidi(tuning).length;
  const byPos = new Map(cells.map((c) => [`${c.string}:${c.fret}`, c]));
  const frets = Array.from({ length: FRETS + 1 }, (_, f) => f);
  const cols = { gridTemplateColumns: `repeat(${FRETS + 1}, minmax(0, 1fr))` };

  return (
    <div className="mt-2 overflow-x-auto">
      <div className="min-w-[560px]">
        <div role="img" aria-label={`Fretboard in ${keyRoot} ${scale}`}>
          {Array.from({ length: strings }, (_, row) => strings - 1 - row).map((s) => (
            <div key={s} className="grid" style={cols}>
              {frets.map((f) => {
                const c = byPos.get(`${s}:${f}`);
                let dot = null;
                if (c) {
                  const cls = c.chordTone
                    ? c.isReferenceRoot
                      ? "bg-amber-200 text-amber-900 border-white"
                      : "bg-amber-500 text-gray-900 border-amber-300"
                    : "bg-gray-900 text-gray-300 border-gray-500";
                  const ring = c.chordTone && !c.inScale ? "border-dashed" : "";
                  dot = (
                    <span className={`relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${cls} ${ring}`}>
                      {labelMode === "intervals" ? c.label : c.noteName}
                    </span>
                  );
                }
                return (
                  <div
                    key={f}
                    className={`relative h-9 flex items-center justify-center before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-gray-500 ${
                      f === 0 ? "border-r-[5px] border-gray-300" : "border-r-2 border-gray-500"
                    }`}
                  >
                    {dot}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="grid" style={cols} aria-hidden>
          {frets.map((f) => (
            <div key={f} className="h-5 text-center text-[11px] text-gray-500">{f}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
