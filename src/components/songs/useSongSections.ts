"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SongGoneError, fetchSong, inSongOrder, putSections } from "./songApi";
import { errorText, listRiffs } from "./riffApi";
import { UNKNOWN_RIFF_ERROR, dropUnknownRiffs, addRow, moveRow, reconcileRows, removeRow, rowsToInput, shapeRows, updateRow, type Row } from "@/lib/songwriting/songEdit";
import type { Composition } from "@/types";

/**
 * A song's section rows. Every change shows at once and is saved by sending
 * the whole list, one save at a time per song; only the reply to the last
 * save in a burst is shown, so an older reply never undoes a newer change.
 * A failed save shows its error and takes the server's copy back.
 */
export function useSongSections(
  songId: string,
  initial: Composition,
  riffsById: (id: string) => Row["riff"],
  onGone: () => void,
  onSaved: (song: Composition) => void,
) {
  const [rows, setRows] = useState<Row[]>(() => reconcileRows([], initial.sections));
  const [error, setError] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  const pending = useRef(0);
  const alive = useRef(true);
  const counter = useRef(0);
  const latest = useRef({ onGone, onSaved, riffsById });
  useEffect(() => {
    latest.current = { onGone, onSaved, riffsById };
    rowsRef.current = rows;
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const newKey = useCallback(() => `row-${counter.current++}`, []);

  const settle = useCallback((song: Composition) => {
    if (!alive.current || pending.current > 0) return;
    const next = reconcileRows(rowsRef.current, song.sections);
    rowsRef.current = next;
    setRows(next);
  }, []);

  const apply = useCallback(
    (next: Row[]) => {
      rowsRef.current = next;
      setRows(next);
      setError(null);
      pending.current++;
      void inSongOrder(songId, async () => {
        try {
          let song: Composition;
          try {
            song = await putSections(songId, rowsToInput(next));
          } catch (err) {
            if (!(err instanceof Error) || err.message !== UNKNOWN_RIFF_ERROR) throw err;
            // A riff was deleted elsewhere: drop it from the rows, keep the edit, save once more.
            const existing = new Set((await listRiffs()).map((r) => r.id));
            const fixed = dropUnknownRiffs(next, existing);
            song = await putSections(songId, rowsToInput(fixed));
            if (alive.current && rowsRef.current === next) {
              rowsRef.current = fixed;
              setRows(fixed);
            }
          }
          pending.current--;
          settle(song);
          if (alive.current) latest.current.onSaved(song);
        } catch (err) {
          pending.current--;
          if (err instanceof SongGoneError) {
            if (alive.current) latest.current.onGone();
            return;
          }
          if (alive.current) setError(`Could not save the sections: ${errorText(err)}`);
          try {
            settle(await fetchSong(songId));
          } catch (e2) {
            if (e2 instanceof SongGoneError && alive.current) latest.current.onGone();
          }
        }
      });
    },
    [songId, settle],
  );

  /** Take the server's copy again (the window was away; a riff may have been deleted meanwhile). */
  const refresh = () =>
    void inSongOrder(songId, async () => {
      try {
        settle(await fetchSong(songId));
      } catch (err) {
        if (err instanceof SongGoneError && alive.current) latest.current.onGone();
      }
    });
  const riffFor = (id: string | null) => (id ? latest.current.riffsById(id) : null);
  const current = () => rowsRef.current;
  return {
    rows,
    error,
    refresh,
    setLabel: (i: number, label: string) => apply(updateRow(current(), i, { label })),
    setRiff: (i: number, riffId: string | null) => apply(updateRow(current(), i, { riffId, riff: riffFor(riffId), riffDeleted: false })),
    setRepeats: (i: number, repeats: number) => apply(updateRow(current(), i, { repeats })),
    move: (i: number, by: -1 | 1) => apply(moveRow(current(), i, by)),
    remove: (i: number) => apply(removeRow(current(), i)),
    add: () => apply(addRow(current(), newKey())),
    startFromShape: () => apply(shapeRows(newKey)),
  };
}
