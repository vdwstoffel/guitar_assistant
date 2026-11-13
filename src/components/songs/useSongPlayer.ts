"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { RiffGoneError, errorText, fetchRiff, inRiffOrder } from "./riffApi";
import { useRiffPlayer } from "./useRiffPlayer";
import type { Row } from "@/lib/songwriting/songEdit";
import { songProgram, type FetchedRiff, type SongProgram } from "@/lib/songwriting/songPlayback";
import type { Riff } from "@/types";

/** What the player holds before the song first plays: nothing to hear (no parts). */
const SILENT_RIFF: Riff = {
  id: "",
  name: "",
  keyRoot: "E",
  scale: "Minor",
  tuning: "standard",
  tempo: 120,
  tsNum: 4,
  tsDen: 4,
  progression: [],
  createdAt: "",
  updatedAt: "",
  parts: [],
};
const SILENT: SongProgram["sections"] = [{ riff: SILENT_RIFF, repeats: 1, row: -1 }];

export interface SongPlayer {
  /** Give this to an element that is laid out but off-screen (HIDDEN_PLAYER_STYLE). */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The sound is loaded: Play can start. */
  ready: boolean;
  /** The song is playing, or its riffs are on their way to start it. */
  playing: boolean;
  /** The section playing; null while stopped (and while its riffs load). */
  currentSection: number | null;
  /** From the top, or from section `fromSection` (the first with a riff at or after it). Restarts if playing. */
  play(fromSection?: number): void;
  stop(): void;
  /** Sections passed over in the latest run: a riff that would not load, or has no tempo yet. */
  notes: string[];
  /** What the song cannot play (a tab left out, a recording that plays silent). */
  error: string | null;
}

/**
 * Plays a song (spec "The Songs view", ruling 7): Play fetches the riffs of
 * the sections from where it starts, then hands them all to one riff player
 * as one score — each riff its `repeats` times at its own tempo with its part
 * settings — so the song plays through with no stop between sections. A
 * section without a riff is passed over, and so is one whose riff will not
 * load or has no tempo yet (with a note). Stops by itself after the last
 * section, on `stop()`, and on unmount. The section shown as playing is the
 * one the playhead is in.
 */
export function useSongPlayer(rows: readonly Row[], options: { onRiffGone?(): void } = {}): SongPlayer {
  /** The run in progress: which press of Play, and (once its riffs are in) what it plays. */
  const [run, setRun] = useState<{ id: number; program: SongProgram | null } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  // For the callbacks: the newest rows and options, the run in progress.
  const rowsRef = useRef(rows);
  const onRiffGoneRef = useRef(options.onRiffGone);
  useEffect(() => {
    rowsRef.current = rows;
    onRiffGoneRef.current = options.onRiffGone;
  });
  const runRef = useRef<number | null>(null);
  const runIds = useRef(0);

  const end = () => {
    runRef.current = null;
    setRun(null);
  };

  const player = useRiffPlayer({
    sections: run?.program?.sections ?? SILENT,
    loop: false,
    onFinished: end,
  });
  const { play: playRiff, stop: stopRiff } = player;

  // A run's program handed over: play it once the player has it. This runs
  // after useRiffPlayer's own effects for the same render, so the score is in
  // (play waits for its sound and recordings).
  const started = useRef<number | null>(null);
  useEffect(() => {
    if (!run?.program || started.current === run.id || runRef.current !== run.id) return;
    started.current = run.id;
    playRiff();
  }, [run, playRiff]);

  // Unmounted (left the Songs view, or another song): fetches still on their way must not start anything.
  useEffect(
    () => () => {
      runRef.current = null;
    },
    [],
  );

  const play = (fromSection = 0) => {
    stopRiff();
    const id = ++runIds.current;
    runRef.current = id;
    setRun({ id, program: null });
    setNotes([]);
    const sections = rowsRef.current;
    const ids = [...new Set(sections.slice(fromSection).flatMap((r) => (r.riffId ? [r.riffId] : [])))];
    void Promise.all(
      ids.map((riffId) =>
        inRiffOrder(riffId, () => fetchRiff(riffId)).then(
          (riff): [string, FetchedRiff] => [riffId, { ok: true, riff }],
          (err: unknown): [string, FetchedRiff] => [riffId, { ok: false, gone: err instanceof RiffGoneError, message: errorText(err) }],
        ),
      ),
    ).then((results) => {
      if (runRef.current !== id) return;
      const program = songProgram(sections, fromSection, new Map(results));
      setNotes(program.notes);
      // The rows then show "riff deleted" (a refresh is not an edit: playing carries on).
      if (program.gone) onRiffGoneRef.current?.();
      if (program.sections.length === 0) {
        end();
        return;
      }
      setRun({ id, program });
    });
  };

  const stop = () => {
    if (runRef.current === null) return;
    end();
    stopRiff();
  };

  const program = run?.program;
  const at = player.currentSection;
  return {
    containerRef: player.containerRef,
    ready: player.ready,
    playing: run !== null,
    currentSection: program && at !== null ? (program.sections[at]?.row ?? null) : null,
    play,
    stop,
    notes,
    error: run && player.error ? player.error : null,
  };
}
