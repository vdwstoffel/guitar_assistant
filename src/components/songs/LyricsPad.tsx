"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "./riffApi";
import { SongGoneError } from "./songApi";
import { createLyricsHolder } from "@/lib/songwriting/heldLyrics";

const DELAY_MS = 800;

const askBeforeClosing = (e: BeforeUnloadEvent) => e.preventDefault();

/**
 * Lyrics that were not saved yet when their pad went away, kept for as long
 * as the page lives: closing it asks first, and opening the song again
 * restores them and saves them again.
 */
const heldLyrics = createLyricsHolder((holding) => {
  if (holding) window.addEventListener("beforeunload", askBeforeClosing);
  else window.removeEventListener("beforeunload", askBeforeClosing);
});

/**
 * A plain lyrics notepad. It saves a moment after typing stops, on leaving
 * the box and when it goes away mid-edit; the browser asks before the tab
 * closes while something is typed but not saved yet. A save that fails stays
 * unsaved (still guarded, saved again on the next blur, or with Retry); one
 * that fails after the pad has gone is held for the next pad of that song.
 */
export default function LyricsPad({ songId, value, save }: { songId: string; value: string; save(text: string): Promise<void> }) {
  // What a pad for this song left unsaved, if anything: it wins over the server's copy, and is saved again on mount.
  const [restored] = useState(() => heldLyrics.peek(songId));
  const [text, setText] = useState(restored ?? value);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestText = useRef(restored ?? value);
  const unsaved = useRef(false);
  const inFlight = useRef(0);
  /** Saves sent so far: a failure re-arms only when no newer save or edit speaks for the text. */
  const sends = useRef(0);
  const alive = useRef(true);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!unsaved.current) return;
    unsaved.current = false;
    const sent = latestText.current;
    const mine = ++sends.current;
    inFlight.current++;
    saveRef.current(sent).then(
      () => {
        inFlight.current--;
        heldLyrics.release(songId, sent);
        if (alive.current && sends.current === mine) setError(null);
      },
      (err: unknown) => {
        inFlight.current--;
        // The song is gone (its view says so): there is nowhere to save these.
        if (err instanceof SongGoneError) {
          heldLyrics.release(songId, sent);
          return;
        }
        // A newer save, or newer typing, is what counts now.
        if (sends.current !== mine || unsaved.current) return;
        if (!alive.current) {
          // Held since the pad went: the next pad for this song restores them.
          console.error("Could not save the lyrics; they are kept until the song is opened again:", err);
          return;
        }
        unsaved.current = true;
        setError(`Could not save the lyrics: ${errorText(err)}`);
      },
    );
  }, [songId]);

  useEffect(() => {
    alive.current = true;
    /** Typed, or sent, but not known to be saved. */
    const unconfirmed = () => unsaved.current || inFlight.current > 0;
    const guard = (e: BeforeUnloadEvent) => {
      if (unconfirmed()) e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    // Left unsaved by the last pad for this song: save it again now.
    if (heldLyrics.take(songId) !== null) {
      unsaved.current = true;
      flush();
    }
    return () => {
      alive.current = false;
      window.removeEventListener("beforeunload", guard);
      // Not confirmed saved yet: held (and the page guarded) until a save lands.
      if (unconfirmed()) heldLyrics.hold(songId, latestText.current);
      flush();
    };
  }, [flush, songId]);

  return (
    <div>
      <label htmlFor="song-lyrics" className="mb-1 block text-sm font-semibold text-gray-300">
        Lyrics
      </label>
      <textarea
        id="song-lyrics"
        value={text}
        rows={10}
        onChange={(e) => {
          setText(e.target.value);
          latestText.current = e.target.value;
          unsaved.current = true;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flush, DELAY_MS);
        }}
        onBlur={flush}
        placeholder="Words, ideas, a melody in your head…"
        className="w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-sm text-gray-100 focus:border-amber-500 focus:outline-none"
      />
      {error && (
        <p role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-sm text-red-400">
          {error}
          <button
            type="button"
            onClick={flush}
            className="rounded border border-red-800 px-2 py-0.5 text-xs font-medium text-red-300 hover:bg-red-950"
          >
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
