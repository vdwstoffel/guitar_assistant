"use client";

import { useEffect, useState } from "react";
import DraftInput from "./DraftInput";
import LyricsPad from "./LyricsPad";
import SectionList, { type SectionActions } from "./SectionList";
import { HIDDEN_PLAYER_STYLE } from "./hiddenScorePlayer";
import { SongGoneError, deleteSong, inSongOrder, patchSong } from "./songApi";
import { errorText } from "./riffApi";
import { useSongPlayer } from "./useSongPlayer";
import { useSongSections } from "./useSongSections";
import { playableSections } from "@/lib/songwriting/songs";
import type { Composition, RiffSummary } from "@/types";

export interface SongDetailProps {
  song: Composition;
  riffs: RiffSummary[];
  /** A save came back: the list shows the new name and section count. */
  onSaved(song: Composition): void;
  onGone(): void;
  onDeleted(name: string): void;
}

const parseName = (t: string) => (t.trim().length >= 1 && t.trim().length <= 80 ? t.trim() : null);
const PLAY = "rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * One song: its name, Play song, its sections in order, its lyrics. Keyed by
 * song id, so it starts fresh for each song (and another song, or leaving,
 * stops the one playing).
 */
export default function SongDetail({ song, riffs, onSaved, onGone, onDeleted }: SongDetailProps) {
  const [name, setName] = useState(song.name);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const sections = useSongSections(song.id, song, (id) => riffs.find((r) => r.id === id) ?? null, onGone, onSaved);
  const { refresh } = sections;
  const { containerRef, ready, playing, currentSection, play, stop, notes, error: playError } = useSongPlayer(sections.rows, { onRiffGone: refresh });
  const canPlay = playableSections(sections.rows).length > 0;

  // Changing what plays, or where, stops the song; renaming a section does not.
  const stopping =
    <A extends unknown[]>(edit: (...args: A) => void) =>
    (...args: A) => {
      stop();
      edit(...args);
    };
  const actions: SectionActions = {
    setLabel: sections.setLabel,
    setRiff: stopping(sections.setRiff),
    setRepeats: stopping(sections.setRepeats),
    move: stopping(sections.move),
    remove: stopping(sections.remove),
    add: stopping(sections.add),
    startFromShape: stopping(sections.startFromShape),
  };

  // Coming back to the window: a riff may have been deleted meanwhile.
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  });

  const rename = (next: string) => {
    setName(next);
    setError(null);
    void inSongOrder(song.id, async () => {
      try {
        onSaved(await patchSong(song.id, { name: next }));
      } catch (err) {
        if (err instanceof SongGoneError) onGone();
        else {
          setName(song.name);
          setError(`Could not rename: ${errorText(err)}`);
        }
      }
    });
  };

  const saveLyrics = (lyrics: string) =>
    inSongOrder(song.id, async () => {
      try {
        await patchSong(song.id, { lyrics });
      } catch (err) {
        if (err instanceof SongGoneError) onGone();
        throw err;
      }
    });

  const remove = async () => {
    stop();
    try {
      await inSongOrder(song.id, () => deleteSong(song.id));
      onDeleted(name);
    } catch (err) {
      if (err instanceof SongGoneError) onGone();
      else setError(`Could not delete: ${errorText(err)}`);
      setConfirming(false);
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <DraftInput value={name} parse={parseName} onCommit={rename} aria-label="Song name" maxLength={80} className="min-w-0 flex-1 text-lg font-semibold" />
        <button
          type="button"
          onClick={() => (playing ? stop() : play())}
          disabled={!playing && (!canPlay || !ready)}
          title={playing ? undefined : !canPlay ? "Pick a riff for a section first" : ready ? undefined : "Loading the sound…"}
          className={PLAY}
        >
          {playing ? "■ Stop" : "▶ Play song"}
        </button>
        {confirming ? (
          <span className="flex items-center gap-2 text-sm text-gray-300">
            Delete “{name}”?
            <button type="button" onClick={remove} className="rounded bg-red-700 px-2 py-1 text-white hover:bg-red-600">
              Yes, delete
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-gray-400 hover:text-white">
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="text-sm text-gray-400 hover:text-red-400">
            Delete song
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {playError && (
        <p role="alert" className="text-sm text-red-400">
          {playError}
        </p>
      )}
      {notes.length > 0 && (
        <div role="status" className="flex flex-col gap-0.5 text-xs text-amber-400">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}
      <section aria-label="Sections">
        <h2 className="mb-2 text-sm font-semibold text-gray-300">Sections</h2>
        {sections.error && (
          <p role="alert" className="mb-2 text-sm text-red-400">
            {sections.error}
          </p>
        )}
        <SectionList
          rows={sections.rows}
          riffs={riffs}
          actions={actions}
          playingIndex={currentSection}
          canPlay={playing || ready}
          onPlayFrom={play}
        />
      </section>
      <LyricsPad songId={song.id} value={song.lyrics} save={saveLyrics} />
      <div ref={containerRef} style={HIDDEN_PLAYER_STYLE} aria-hidden className="pointer-events-none" />
    </div>
  );
}
