"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PartGoneError, RiffGoneError, errorText, inRiffOrder, patchPart } from "./riffApi";
import type { MixEdit, PartEdit } from "@/lib/songwriting/riffMix";
import type { Riff } from "@/types";

/** A level is saved once the slider has rested this long. */
const LEVEL_SAVE_MS = 300;

export interface RiffMix {
  /** Mixer changes not yet saved, oldest first: lay them over the riff (applyMixEdits). */
  edits: MixEdit[];
  /** A part's mix, or its name. */
  setPart(partId: string, fields: PartEdit): void;
  error: string | null;
}

/**
 * The riff's mixer settings (and its parts' names), saved as they change:
 * toggles and names at once, a level once its slider rests. Every save goes
 * through `inRiffOrder`, so it lands in order with the header's and the tab
 * editor's. Until a change is saved it is one of `edits`, which the caller
 * lays over the riff so the mixer and the player follow it at once. Levels
 * still waiting are saved on unmount.
 */
export function useRiffMix(riffId: string, handlers: { onRiffChange(riff: Riff): void; onGone(): void }): RiffMix {
  const [sent, setSent] = useState<{ seq: number; edit: MixEdit }[]>([]);
  // Levels waiting for their slider to rest, by part id.
  const [waiting, setWaiting] = useState<Record<string, MixEdit>>({});
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; edit: MixEdit }>());
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  const send = useCallback(
    (edit: MixEdit) => {
      const n = ++seq.current;
      setSent((s) => [...s, { seq: n, edit }]);
      setError(null);
      void inRiffOrder(riffId, async () => {
        try {
          latest.current.onRiffChange((await patchPart(riffId, edit.partId, edit.fields)).riff);
        } catch (err) {
          // A part deleted meanwhile: nothing to save to, the riff as it is now shows.
          if (err instanceof PartGoneError) latest.current.onRiffChange(err.riff);
          else if (err instanceof RiffGoneError) latest.current.onGone();
          else setError(`Could not save the ${"name" in edit.fields ? "name" : "mix"}: ${errorText(err)}`);
        } finally {
          setSent((s) => s.filter((x) => x.seq !== n));
        }
      });
    },
    [riffId],
  );

  const change = useCallback(
    (edit: MixEdit) => {
      if (!("level" in edit.fields)) {
        send(edit);
        return;
      }
      const key = edit.partId;
      const old = timers.current.get(key);
      if (old) clearTimeout(old.timer);
      const timer = setTimeout(() => {
        timers.current.delete(key);
        setWaiting((w) => {
          const next = { ...w };
          delete next[key];
          return next;
        });
        send(edit);
      }, LEVEL_SAVE_MS);
      timers.current.set(key, { timer, edit });
      setWaiting((w) => ({ ...w, [key]: edit }));
    },
    [send],
  );

  // Leaving (the detail is keyed by riff): a level still waiting is saved now.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const { timer, edit } of pending.values()) {
        clearTimeout(timer);
        send(edit);
      }
      pending.clear();
    };
  }, [send]);

  const edits = useMemo(() => [...sent.map((s) => s.edit), ...Object.values(waiting)], [sent, waiting]);
  const setPart = useCallback((partId: string, fields: PartEdit) => change({ partId, fields }), [change]);
  return { edits, setPart, error };
}
