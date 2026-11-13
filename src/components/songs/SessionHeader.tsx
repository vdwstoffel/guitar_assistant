"use client";

import { NOTES, SCALE_FORMULAS } from "@/lib/musicTheory";
import { SESSION_TUNING_IDS, tuningLabel } from "@/lib/songwriting/tunings";

const SCALES = Object.keys(SCALE_FORMULAS).filter((s) => s !== "None");

const SELECT =
  "bg-gray-700 text-gray-100 text-sm rounded-lg px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-amber-500";

interface SessionHeaderProps {
  keyRoot: string;
  scale: string;
  tuning: string;
  onKeyChange: (root: string) => void;
  onScaleChange: (scale: string) => void;
  onTuningChange: (tuning: string) => void;
}

/** Top row of the Write view: what key, scale and tuning the song is in. */
export default function SessionHeader({ keyRoot, scale, tuning, onKeyChange, onScaleChange, onTuningChange }: SessionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-gray-50">New idea</h1>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
          Key
          <select value={keyRoot} onChange={(e) => onKeyChange(e.target.value)} className={SELECT}>
            {NOTES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
          Scale
          <select value={scale} onChange={(e) => onScaleChange(e.target.value)} className={SELECT}>
            {SCALES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
          Tuning
          <select value={tuning} onChange={(e) => onTuningChange(e.target.value)} className={SELECT}>
            {SESSION_TUNING_IDS.map((t) => (
              <option key={t} value={t}>{tuningLabel(t)}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
