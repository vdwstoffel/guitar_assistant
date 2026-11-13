"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NOTES } from "@/lib/musicTheory";
import { CHORD_QUALITIES, chordName, suggestedChords, type ChordQuality, type ProgressionChord } from "@/lib/songwriting/theory";

interface ProgressionEditorProps {
  keyRoot: string;
  scale: string;
  progression: ProgressionChord[];
  onChange: (next: ProgressionChord[]) => void;
  /** The chord shown on the fretboard. */
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const TINY = "w-6 h-6 rounded bg-gray-700 border border-gray-600 text-gray-200 text-xs hover:bg-gray-600 disabled:opacity-30";
const SELECT = "bg-gray-700 text-gray-100 text-sm rounded-lg px-2 py-1 border border-gray-600 focus:outline-none focus:border-amber-500";

/** The chord chips, and the + Chord popover that adds to them. */
export default function ProgressionEditor({ keyRoot, scale, progression, onChange, selectedIndex, onSelect }: ProgressionEditorProps) {
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<string>(keyRoot);
  const [quality, setQuality] = useState<ChordQuality>("Power");
  const wrap = useRef<HTMLDivElement>(null);
  const suggestions = useMemo(() => suggestedChords(keyRoot, scale), [keyRoot, scale]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const add = (c: ProgressionChord) => {
    onChange([...progression, { ...c, bars: 1 }]);
    setOpen(false);
  };
  const patch = (i: number, p: Partial<ProgressionChord>) => onChange(progression.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const move = (i: number, to: number) => {
    const next = [...progression];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
    onSelect(to);
  };
  const remove = (i: number) => {
    onChange(progression.filter((_, j) => j !== i));
    if (i <= selectedIndex) onSelect(Math.max(0, selectedIndex - 1));
  };

  return (
    <div className="flex flex-wrap items-start gap-2">
      {progression.map((c, i) => {
        const selected = selectedIndex === i;
        return (
          <div
            key={i}
            className={`rounded-lg border p-2 flex flex-col items-center gap-1.5 ${
              selected ? "bg-amber-900 border-amber-500 text-amber-100" : "bg-gray-700 border-gray-600 text-gray-50"
            }`}
          >
            <button type="button" onClick={() => onSelect(i)} aria-pressed={selected} aria-label={`Show ${chordName(c)} on the fretboard`} className="min-w-14 text-center font-semibold">
              {chordName(c)}
              <small className={`block font-normal text-[11px] ${selected ? "text-amber-300" : "text-gray-400"}`}>
                {c.bars} {c.bars === 1 ? "bar" : "bars"}
              </small>
            </button>
            <div className="flex items-center gap-1">
              <button type="button" aria-label={`Move ${chordName(c)} left`} className={TINY} disabled={i === 0} onClick={() => move(i, i - 1)}>←</button>
              <select
                aria-label={`Bars for ${chordName(c)}`}
                value={c.bars}
                onChange={(e) => patch(i, { bars: Number(e.target.value) })}
                className="bg-gray-800 text-gray-200 text-xs rounded border border-gray-600 h-6"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button type="button" aria-label={`Move ${chordName(c)} right`} className={TINY} disabled={i === progression.length - 1} onClick={() => move(i, i + 1)}>→</button>
              <button type="button" aria-label={`Remove ${chordName(c)}`} className={TINY} onClick={() => remove(i)}>✕</button>
            </div>
          </div>
        );
      })}
      <div className="relative" ref={wrap}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="border border-amber-800 text-amber-400 rounded-lg px-3 py-2 text-sm hover:bg-gray-700"
        >
          + Chord
        </button>
        {open && (
          <div role="dialog" aria-label="Add a chord" className="absolute left-0 top-full mt-1 z-20 w-72 max-w-[85vw] bg-gray-800 border border-gray-600 rounded-xl p-3 shadow-xl">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Fits {keyRoot} {scale}</div>
            <div className="flex flex-wrap gap-1 mb-3">
              {suggestions.map((c) => (
                <button key={`${c.root}:${c.quality}`} type="button" onClick={() => add(c)} className="px-2 py-1 rounded bg-gray-700 border border-gray-600 text-sm text-gray-100 hover:bg-gray-600">
                  {chordName(c)}
                </button>
              ))}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Any chord</div>
            <div className="flex items-center gap-2">
              <select aria-label="Chord root" value={root} onChange={(e) => setRoot(e.target.value)} className={SELECT}>
                {NOTES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <select aria-label="Chord quality" value={quality} onChange={(e) => setQuality(e.target.value as ChordQuality)} className={SELECT}>
                {CHORD_QUALITIES.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
              <button type="button" onClick={() => add({ root, quality, bars: 1 })} className="bg-amber-600 text-gray-900 font-semibold rounded-lg px-3 py-1 text-sm hover:bg-amber-500">
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
