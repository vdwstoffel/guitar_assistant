"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SongDetail from "./SongDetail";
import { SongGoneError, createSong, fetchSong, inSongOrder, listSongs } from "./songApi";
import { errorText, listRiffs } from "./riffApi";
import type { SongsLocation } from "@/lib/songwriting/riffView";
import type { Composition, RiffSummary, SongListItem } from "@/types";

const CENTER = "flex h-full min-h-40 items-center justify-center text-gray-500";

const item = (s: Composition): SongListItem => ({ id: s.id, name: s.name, sectionCount: s.sections.length, updatedAt: s.updatedAt });

/** Your songs, newest first, beside the one picked. */
export default function SongsView({ songId, navigate }: { songId: string | null; navigate(loc: SongsLocation): void }) {
  const [list, setList] = useState<SongListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [riffs, setRiffs] = useState<RiffSummary[]>([]);
  const [riffsError, setRiffsError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ id: string; song: Composition | null; error: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef(songId);
  useEffect(() => {
    current.current = songId;
  }, [songId]);

  useEffect(() => {
    let live = true;
    listSongs().then(
      (l) => live && setList(l),
      (err: unknown) => live && setListError(errorText(err)),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    const load = () =>
      listRiffs().then(
        (r) => {
          if (!live) return;
          setRiffs(r);
          setRiffsError(null);
        },
        (err: unknown) => live && setRiffsError(errorText(err)),
      );
    void load();
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  const gone = useCallback(
    (id: string) => {
      setList((l) => l && l.filter((s) => s.id !== id));
      if (current.current === id) {
        setNotice("This song was deleted");
        navigate({ view: "songs" });
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (!songId) return;
    let live = true;
    void inSongOrder(songId, async () => {
      try {
        const song = await fetchSong(songId);
        if (live) setLoaded({ id: songId, song, error: null });
      } catch (err) {
        if (!live) return;
        if (err instanceof SongGoneError) gone(songId);
        else setLoaded({ id: songId, song: null, error: errorText(err) });
      }
    });
    return () => {
      live = false;
    };
  }, [songId, gone]);

  const saved = useCallback((s: Composition) => setList((l) => l && l.map((x) => (x.id === s.id ? item(s) : x))), []);

  const create = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const s = await createSong();
      setList((l) => [item(s), ...(l ?? [])]);
      navigate({ view: "songs", song: s.id });
    } catch (err) {
      setNotice(`Could not create a song: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const mine = songId !== null && loaded?.id === songId ? loaded : null;
  let detail;
  if (!songId) detail = <div className={CENTER}>{list && list.length > 0 ? "Pick a song to see it here." : null}</div>;
  else if (mine?.error) detail = <p role="alert" className="text-red-400">Could not load this song: {mine.error}</p>;
  else if (!mine?.song) detail = <div className={CENTER}>Loading…</div>;
  else {
    const id = mine.song.id;
    detail = (
      <SongDetail
        key={id}
        song={mine.song}
        riffs={riffs}
        onSaved={saved}
        onGone={() => gone(id)}
        onDeleted={(name) => {
          setList((l) => l && l.filter((s) => s.id !== id));
          setNotice(`Deleted “${name}”.`);
          navigate({ view: "songs" });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col md:h-full md:flex-row">
      <nav aria-label="Songs" className="max-h-72 shrink-0 overflow-y-auto border-b border-gray-800 md:max-h-none md:w-64 md:border-b-0 md:border-r">
        <div className="p-2">
          <button
            type="button"
            disabled={busy}
            onClick={create}
            className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            New song
          </button>
        </div>
        {listError ? (
          <p role="alert" className="p-4 text-sm text-red-400">Could not load your songs: {listError}</p>
        ) : list === null ? (
          <p className="p-4 text-sm text-gray-500">Loading songs…</p>
        ) : list.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No songs yet. Piece riffs together into verses and choruses.</p>
        ) : (
          <ul className="flex flex-col px-2 pb-2">
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={s.id === songId ? "true" : undefined}
                  onClick={() => {
                    setNotice(null);
                    navigate({ view: "songs", song: s.id });
                  }}
                  className={`flex w-full flex-col gap-0.5 rounded-lg border-l-2 px-3 py-2 text-left ${
                    s.id === songId ? "border-amber-500 bg-gray-800" : "border-transparent hover:bg-gray-800/60"
                  }`}
                >
                  <span className="truncate font-semibold text-gray-100">{s.name}</span>
                  <span className="text-xs text-gray-500">
                    {s.sectionCount} {s.sectionCount === 1 ? "section" : "sections"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <section aria-label="Song" className="min-w-0 flex-1 p-4 md:overflow-y-auto">
        {riffsError && (
          <p role="alert" className="mb-3 text-sm text-red-400">
            Could not load your riffs for the picker: {riffsError}
          </p>
        )}
        {notice && (
          <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200">
            {notice}
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="px-1 text-gray-400 hover:text-white">
              ×
            </button>
          </div>
        )}
        {detail}
      </section>
    </div>
  );
}
