"use client";

import { useRef } from "react";
import type { TabData } from "@/lib/tabData";
import {
  createEmptyBar,
  createEmptyBeat,
  DURATION_SYMBOL,
  DURATION_CYCLE,
  nextDuration,
} from "@/lib/tabData";

const STRING_LABELS = ["e", "B", "G", "D", "A", "E"];

interface VisualTabEditorProps {
  data: TabData;
  onChange: (data: TabData) => void;
}

export default function VisualTabEditor({ data, onChange }: VisualTabEditorProps) {
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const k = (bi: number, bti: number, si: number) => `${bi}-${bti}-${si}`;

  // ── Fret entry ────────────────────────────────────────────────────────────
  const setFret = (bi: number, bti: number, si: number, value: number | null) => {
    onChange({
      ...data,
      bars: data.bars.map((bar, b) =>
        b !== bi
          ? bar
          : {
              ...bar,
              beats: bar.beats.map((beat, bt) =>
                bt !== bti
                  ? beat
                  : { ...beat, strings: beat.strings.map((f, s) => (s !== si ? f : value)) }
              ),
            }
      ),
    });
  };

  const handleInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    bi: number,
    bti: number,
    si: number
  ) => {
    const v = e.target.value.trim();
    if (v === "" || v === "-") {
      setFret(bi, bti, si, null);
    } else {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 0 && n <= 24) setFret(bi, bti, si, n);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    bi: number,
    bti: number,
    si: number
  ) => {
    const totalBeats = data.bars[bi].beats.length;
    const totalBars = data.bars.length;
    const focus = (b: number, bt: number, s: number) =>
      inputRefs.current.get(k(b, bt, s))?.focus();

    if (e.key === "Tab" || e.key === "ArrowRight") {
      e.preventDefault();
      if (bti + 1 < totalBeats) focus(bi, bti + 1, si);
      else if (bi + 1 < totalBars) focus(bi + 1, 0, si);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (bti > 0) focus(bi, bti - 1, si);
      else if (bi > 0) focus(bi - 1, data.bars[bi - 1].beats.length - 1, si);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (si > 0) focus(bi, bti, si - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (si < 5) focus(bi, bti, si + 1);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      setFret(bi, bti, si, null);
    }
  };

  // ── Per-beat duration ─────────────────────────────────────────────────────
  const cycleBeatDuration = (bi: number, bti: number) => {
    onChange({
      ...data,
      bars: data.bars.map((bar, b) =>
        b !== bi
          ? bar
          : {
              ...bar,
              beats: bar.beats.map((beat, bt) =>
                bt !== bti ? beat : { ...beat, duration: nextDuration(beat.duration) }
              ),
            }
      ),
    });
  };

  // ── Bar / beat management ─────────────────────────────────────────────────
  const addBar = () =>
    onChange({
      ...data,
      bars: [
        ...data.bars,
        createEmptyBar(data.bars[data.bars.length - 1]?.beats.length ?? 8, data.defaultDuration),
      ],
    });

  const removeBar = () => {
    if (data.bars.length <= 1) return;
    onChange({ ...data, bars: data.bars.slice(0, -1) });
  };

  const deleteBar = (bi: number) => {
    if (data.bars.length <= 1) return;
    onChange({ ...data, bars: data.bars.filter((_, i) => i !== bi) });
  };

  const addBeat = (bi: number) => {
    onChange({
      ...data,
      bars: data.bars.map((bar, b) =>
        b !== bi
          ? bar
          : { ...bar, beats: [...bar.beats, createEmptyBeat(data.defaultDuration)] }
      ),
    });
  };

  const removeBeat = (bi: number) => {
    if (data.bars[bi].beats.length <= 1) return;
    onChange({
      ...data,
      bars: data.bars.map((bar, b) =>
        b !== bi ? bar : { ...bar, beats: bar.beats.slice(0, -1) }
      ),
    });
  };

  const deleteBeat = (bi: number, bti: number) => {
    if (data.bars[bi].beats.length <= 1) return;
    onChange({
      ...data,
      bars: data.bars.map((bar, b) =>
        b !== bi
          ? bar
          : { ...bar, beats: bar.beats.filter((_, i) => i !== bti) }
      ),
    });
  };

  return (
    <div className="space-y-3">
      {/* Global controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">BPM</span>
          <input
            type="number"
            value={data.tempo}
            onChange={(e) =>
              onChange({ ...data, tempo: parseInt(e.target.value, 10) || 120 })
            }
            min={20}
            max={300}
            className="w-16 bg-gray-600 text-white text-xs rounded px-2 py-1 border border-gray-500 focus:border-blue-500 focus:outline-none text-center"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Time sig</span>
          <select
            value={data.timeSignature}
            onChange={(e) => onChange({ ...data, timeSignature: e.target.value })}
            className="bg-gray-600 text-white text-xs rounded px-2 py-1 border border-gray-500 focus:border-blue-500 focus:outline-none"
          >
            {["4/4","3/4","2/4","6/8","9/8","12/8","5/4","7/8"].map((ts) => (
              <option key={ts} value={ts}>{ts}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">New beat</span>
          <div className="flex rounded overflow-hidden border border-gray-600">
            {DURATION_CYCLE.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ ...data, defaultDuration: d })}
                title={`Default: ${d === 4 ? "quarter" : d === 8 ? "eighth" : "sixteenth"}`}
                className={`px-2.5 py-1 text-sm border-r border-gray-600 last:border-0 ${
                  data.defaultDuration === d
                    ? "bg-blue-600 text-white"
                    : "bg-gray-600 hover:bg-gray-500 text-gray-300"
                }`}
              >
                {DURATION_SYMBOL[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={addBar}
            className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-300 rounded"
          >
            + Bar
          </button>
          <button
            type="button"
            onClick={removeBar}
            disabled={data.bars.length <= 1}
            className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-300 rounded disabled:opacity-40"
          >
            − Bar
          </button>
          <span className="text-xs text-gray-500 ml-1">
            {data.bars.length} bar{data.bars.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Tab grid */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-max">
          {data.bars.map((bar, bi) => (
            <div key={bi} className="inline-block mr-4 mb-2">
              {/* Bar label */}
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs text-gray-500">Bar {bi + 1}</span>
                <button
                  type="button"
                  onClick={() => addBeat(bi)}
                  className="text-xs text-gray-600 hover:text-gray-400 px-1"
                  title="Add beat"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeBeat(bi)}
                  disabled={bar.beats.length <= 1}
                  className="text-xs text-gray-600 hover:text-gray-400 px-1 disabled:opacity-30"
                  title="Remove last beat"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => deleteBar(bi)}
                  disabled={data.bars.length <= 1}
                  className="text-xs text-gray-600 hover:text-red-400 px-1 disabled:opacity-0 ml-1"
                  title="Delete this bar"
                >
                  ✕
                </button>
              </div>

              {/* String rows */}
              {STRING_LABELS.map((label, si) => (
                <div key={si} className="flex items-center" style={{ height: "22px" }}>
                  <span className="w-4 text-right text-xs text-gray-400 shrink-0 mr-1 select-none">
                    {label}
                  </span>
                  <span className="text-gray-500 text-xs select-none">|</span>
                  {bar.beats.map((beat, bti) => (
                    <input
                      key={bti}
                      ref={(el) => {
                        const key = k(bi, bti, si);
                        if (el) inputRefs.current.set(key, el);
                        else inputRefs.current.delete(key);
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={beat.strings[si] !== null ? String(beat.strings[si]) : ""}
                      onChange={(e) => handleInput(e, bi, bti, si)}
                      onKeyDown={(e) => handleKeyDown(e, bi, bti, si)}
                      placeholder="─"
                      className="w-7 h-5 bg-transparent text-white text-center border-0 border-b border-gray-600 focus:border-blue-400 focus:outline-none placeholder-gray-700"
                      style={{ fontSize: "11px" }}
                    />
                  ))}
                  <span className="text-gray-500 text-xs select-none">|</span>
                </div>
              ))}

              {/* Delete beat row */}
              <div className="flex items-center mt-0.5">
                <span className="w-4 mr-1 select-none" />
                <span className="w-2 select-none" />
                {bar.beats.map((_, bti) => (
                  <button
                    key={bti}
                    type="button"
                    onClick={() => deleteBeat(bi, bti)}
                    disabled={bar.beats.length <= 1}
                    title="Delete this beat"
                    className="w-7 h-3 text-center text-gray-700 hover:text-red-400 disabled:opacity-0"
                    style={{ fontSize: "8px" }}
                  >
                    ✕
                  </button>
                ))}
              </div>

              {/* Duration chips row */}
              <div className="flex items-center mt-0.5">
                <span className="w-4 mr-1 select-none" />
                <span className="w-2 select-none" />
                {bar.beats.map((beat, bti) => (
                  <button
                    key={bti}
                    type="button"
                    onClick={() => cycleBeatDuration(bi, bti)}
                    title={`Beat ${bti + 1}: ${beat.duration === 4 ? "quarter" : beat.duration === 8 ? "eighth" : beat.duration === 16 ? "sixteenth" : beat.duration} — click to cycle`}
                    className="w-7 h-4 text-center hover:bg-gray-700 rounded-sm"
                    style={{
                      fontSize: "9px",
                      color: beat.duration === 4 ? "#9ca3af" : beat.duration === 8 ? "#6b7280" : "#4b5563",
                    }}
                  >
                    {DURATION_SYMBOL[beat.duration] ?? beat.duration}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Type fret numbers (0–24). Arrow keys navigate. Delete clears. Click the note symbol
        below each column to cycle its duration (♩ ♪ ♬).
      </p>
    </div>
  );
}
