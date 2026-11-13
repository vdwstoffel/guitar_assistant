"use client";

import { useEffect, useRef } from "react";
import DraftInput from "./DraftInput";
import { SONG_SHAPE, sectionNotes } from "@/lib/songwriting/songs";
import { parseLabel, riffOptionLabel, type Row } from "@/lib/songwriting/songEdit";
import type { RiffSummary } from "@/types";

export interface SectionActions {
  setLabel(i: number, label: string): void;
  setRiff(i: number, riffId: string | null): void;
  setRepeats(i: number, repeats: number): void;
  move(i: number, by: -1 | 1): void;
  remove(i: number): void;
  add(): void;
  startFromShape(): void;
}

const BTN = "rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent";
const PLAY_BTN = "rounded px-2 py-1 text-sm text-amber-400 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent";
const SELECT = "min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-gray-100 focus:border-amber-500 focus:outline-none";
const SHAPE_NAMES = [...new Set(SONG_SHAPE)];

export interface SectionListProps {
  rows: Row[];
  riffs: RiffSummary[];
  actions: SectionActions;
  /** The section the song is playing: highlighted and scrolled into view. */
  playingIndex?: number | null;
  /** The ▶ on a row with a riff works (the sound is loaded). */
  canPlay?: boolean;
  /** ▶ on a row: play the song from that section. */
  onPlayFrom?(i: number): void;
}

/**
 * The song's sections in order, with a small note between two of them where
 * the key or tempo changes, the playing one highlighted, and a ▶ on each
 * section with a riff to play the song from there.
 */
export default function SectionList({ rows, riffs, actions, playingIndex = null, canPlay = false, onPlayFrom }: SectionListProps) {
  const notes = sectionNotes(rows);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (playingIndex === null) return;
    listRef.current?.children[playingIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [playingIndex]);
  return (
    <div>
      <datalist id="song-section-labels">
        {SHAPE_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {rows.length === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-gray-700 p-4 text-sm text-gray-400">
          <p>No sections yet.</p>
          <button type="button" onClick={actions.startFromShape} className="text-amber-400 hover:underline">
            Start from a common song shape
          </button>
          <span className="text-xs text-gray-500">{SONG_SHAPE.join(" · ")}</span>
        </div>
      )}
      <ol ref={listRef} className="flex flex-col">
        {rows.map((r, i) => {
          const playing = i === playingIndex;
          return (
            <li key={r.key} aria-current={playing ? "true" : undefined}>
              <div className={`flex flex-wrap items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 ${playing ? "ring-2 ring-amber-500" : ""}`}>
                <span className={`w-5 text-right text-xs ${playing ? "font-semibold text-amber-400" : "text-gray-500"}`}>{i + 1}</span>
                <DraftInput
                  value={r.label}
                  parse={parseLabel}
                  onCommit={(label) => actions.setLabel(i, label)}
                  aria-label={`Section ${i + 1} label`}
                  list="song-section-labels"
                  maxLength={40}
                  className="w-32"
                />
                <select
                  aria-label={`Section ${i + 1} riff`}
                  value={r.riffId ?? ""}
                  onChange={(e) => actions.setRiff(i, e.target.value || null)}
                  className={`${SELECT} flex-1 basis-48`}
                >
                  <option value="">— pick a riff —</option>
                  {riffs.map((rf) => (
                    <option key={rf.id} value={rf.id}>
                      {riffOptionLabel(rf)}
                    </option>
                  ))}
                </select>
                {r.riffDeleted && <span className="text-xs text-amber-400">riff deleted</span>}
                <label className="flex items-center gap-1 text-sm text-gray-400">
                  ×
                  <select
                    aria-label={`Section ${i + 1} repeats`}
                    value={r.repeats}
                    onChange={(e) => actions.setRepeats(i, Number(e.target.value))}
                    className={SELECT}
                  >
                    {Array.from({ length: 16 }, (_, n) => n + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                {onPlayFrom && (
                  // Kept in place (invisible) on a row without a riff, so the arrows line up.
                  <button
                    type="button"
                    aria-label={`Play from section ${i + 1}`}
                    title="Play the song from here"
                    disabled={!r.riff || !canPlay}
                    onClick={() => onPlayFrom(i)}
                    className={`${PLAY_BTN} ${r.riff ? "" : "invisible"}`}
                  >
                    {/* U+FE0E: the text glyph, in the button's colour, not the emoji. */}
                    {"\u25B6\uFE0E"}
                  </button>
                )}
                <span className="flex items-center">
                  <button type="button" aria-label={`Move section ${i + 1} up`} disabled={i === 0} onClick={() => actions.move(i, -1)} className={BTN}>
                    ↑
                  </button>
                  <button type="button" aria-label={`Move section ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => actions.move(i, 1)} className={BTN}>
                    ↓
                  </button>
                  <button type="button" aria-label={`Remove section ${i + 1}`} onClick={() => actions.remove(i)} className={`${BTN} hover:text-red-400`}>
                    ✕
                  </button>
                </span>
              </div>
              {notes[i] && <p className="px-4 py-1 text-xs text-gray-500">{notes[i]}</p>}
              {!notes[i] && i < rows.length - 1 && <div className="h-2" />}
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={actions.add} className="mt-2 rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800">
        + Section
      </button>
    </div>
  );
}
