"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PartGoneError,
  RiffGoneError,
  addPart,
  deletePart,
  errorText,
  fetchRiff,
  inRiffOrder,
  patchPart,
  postTake,
} from "./riffApi";
import type { NewTake } from "./usePartTakes";
import type { Trim } from "@/lib/songwriting/partTakes";
import type { Riff, RiffPart } from "@/types";

interface Handlers {
  onRiffChange(riff: Riff): void;
  onGone(): void;
}

/** A failed save, once what it found is shown (the riff without the part, or that the riff is gone), for the panel to report. */
function failure(err: unknown, h: Handlers): unknown {
  if (err instanceof PartGoneError) h.onRiffChange(err.riff);
  else if (err instanceof RiffGoneError) h.onGone();
  return err;
}

export interface RiffParts {
  /** A part is being added. */
  adding: boolean;
  /** Parts being deleted. */
  deleting: string[];
  /** Why adding or deleting a part failed. */
  error: string | null;
  add(kind: RiffPart["kind"]): void;
  remove(part: Pick<RiffPart, "id" | "name">): void;
  /** Rejects with what went wrong (the trim panel shows it and stays open). */
  saveTrim(partId: string, trim: Trim): Promise<void>;
  saveTake(take: NewTake, trim: Trim, audioDuration: number): Promise<void>;
}

/**
 * Adding and deleting a riff's parts, and saving their takes and trims. Every
 * request goes through `inRiffOrder` with the riff's other reads and writes,
 * and each answer comes back as the riff (`onRiffChange`). A part deleted
 * elsewhere shows as gone; a deleted riff calls `onGone`.
 */
export function useRiffParts(riffId: string, handlers: Handlers): RiffParts {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  const add = useCallback(
    (kind: RiffPart["kind"]) => {
      setAdding(true);
      setError(null);
      void inRiffOrder(riffId, async () => {
        try {
          latest.current.onRiffChange((await addPart(riffId, kind)).riff);
        } catch (err) {
          if (err instanceof RiffGoneError) latest.current.onGone();
          else setError(`Could not add the part: ${errorText(err)}`);
        } finally {
          setAdding(false);
        }
      });
    },
    [riffId],
  );

  const remove = useCallback(
    (part: Pick<RiffPart, "id" | "name">) => {
      setDeleting((d) => [...d, part.id]);
      setError(null);
      void inRiffOrder(riffId, async () => {
        try {
          await deletePart(riffId, part.id);
          latest.current.onRiffChange(await fetchRiff(riffId));
        } catch (err) {
          if (err instanceof PartGoneError) latest.current.onRiffChange(err.riff); // already gone: as wanted
          else if (err instanceof RiffGoneError) latest.current.onGone();
          else setError(`Could not delete ${part.name}: ${errorText(err)}`);
        } finally {
          setDeleting((d) => d.filter((id) => id !== part.id));
        }
      });
    },
    [riffId],
  );

  const saveTrim = useCallback(
    (partId: string, trim: Trim) =>
      inRiffOrder(riffId, async () => {
        try {
          latest.current.onRiffChange((await patchPart(riffId, partId, { trimStart: trim.start, trimEnd: trim.end })).riff);
        } catch (err) {
          throw failure(err, latest.current);
        }
      }),
    [riffId],
  );

  const saveTake = useCallback(
    (take: NewTake, trim: Trim, audioDuration: number) =>
      inRiffOrder(riffId, async () => {
        try {
          const meta = { trimStart: trim.start, trimEnd: trim.end, audioDuration };
          latest.current.onRiffChange((await postTake(riffId, take.partId, take, meta)).riff);
        } catch (err) {
          throw failure(err, latest.current);
        }
      }),
    [riffId],
  );

  return { adding, deleting, error, add, remove, saveTrim, saveTake };
}
