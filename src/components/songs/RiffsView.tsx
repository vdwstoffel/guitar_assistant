"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import RiffDetail from "./RiffDetail";
import RiffTag from "./RiffTag";
import { RiffGoneError, errorText, fetchRiff, inRiffOrder, listRiffs } from "./riffApi";
import { isTabbed, replaceSummary, riffShape, riffSummary, type SongsLocation } from "@/lib/songwriting/riffView";
import { mayLeaveTake } from "@/lib/songwriting/unsavedTake";
import type { Riff, RiffSummary } from "@/types";

export interface RiffsViewProps {
  /** The `riff` and `part` query params. */
  riffId: string | null;
  partId: string | null;
  navigate(loc: SongsLocation): void;
}

const GONE = "This riff was deleted";
const CENTER = "flex h-full min-h-40 items-center justify-center text-gray-500";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Every riff, newest first, beside the one picked: its takes and one part's tab. */
export default function RiffsView({ riffId, partId, navigate }: RiffsViewProps) {
  const [list, setList] = useState<RiffSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);
  // The riff last loaded, tagged with the id it was loaded for: a different id means still loading.
  const [loaded, setLoaded] = useState<{ id: string; riff: Riff | null; error: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current = useRef(riffId);
  useEffect(() => {
    current.current = riffId;
  }, [riffId]);

  useEffect(() => {
    let live = true;
    listRiffs().then(
      (riffs) => {
        if (!live) return;
        setList(riffs);
        setListError(null);
      },
      (err: unknown) => {
        if (live) setListError(errorText(err));
      },
    );
    return () => {
      live = false;
    };
  }, [listVersion]);

  const dropFromList = useCallback((id: string) => {
    setList((l) => l && l.filter((r) => r.id !== id));
  }, []);

  // A load or save found the riff deleted. Only the riff on screen sends you
  // back to the list: a late save of one you have already left just drops it.
  // (No refetch here: another riff's header may be saving, and a list fetched
  // before that save lands would show its old name.)
  const gone = useCallback(
    (id: string) => {
      dropFromList(id);
      const open = current.current;
      if (open === id) navigate({ view: "riffs" });
      if (open === id || open === null) setNotice(GONE);
    },
    [dropFromList, navigate],
  );

  useEffect(() => {
    if (!riffId) return;
    let live = true;
    // Queued behind any save of this riff still running, so it loads what was saved.
    void inRiffOrder(riffId, async () => {
      try {
        const riff = await fetchRiff(riffId);
        if (live) setLoaded({ id: riffId, riff, error: null });
      } catch (err) {
        if (!live) return;
        if (err instanceof RiffGoneError) gone(riffId);
        else setLoaded({ id: riffId, riff: null, error: errorText(err) });
      }
    });
    return () => {
      live = false;
    };
  }, [riffId, gone]);

  // A save came back: show it, here and in the list (a riff no longer on screen only updates the list).
  const applyRiff = useCallback((riff: Riff) => {
    setLoaded((cur) => (cur && cur.id === riff.id && cur.riff ? { ...cur, riff } : cur));
    setList((l) => l && replaceSummary(l, riffSummary(riff)));
  }, []);

  // A take being recorded (or waiting to be saved) lives in the riff on screen: leaving it asks first.
  const select = (id: string) => {
    if (id !== riffId && !mayLeaveTake()) return;
    setNotice(null);
    navigate({ view: "riffs", riff: id });
  };

  const mine = riffId !== null && loaded?.id === riffId ? loaded : null;
  const riff = mine?.riff ?? null;

  let detail: ReactNode;
  if (!riffId) {
    detail = <div className={CENTER}>{list && list.length > 0 ? "Pick a riff to see it here." : null}</div>;
  } else if (mine?.error) {
    detail = <p role="alert" className="text-red-400">Could not load this riff: {mine.error}</p>;
  } else if (!riff) {
    detail = <div className={CENTER}>Loading…</div>;
  } else {
    const id = riff.id;
    detail = (
      <RiffDetail
        key={id}
        riff={riff}
        partId={partId}
        onRiffChange={applyRiff}
        // The takes stay on screen beside the tab, so nothing is lost by switching.
        onPickPart={(pid) => navigate({ view: "riffs", riff: id, part: pid })}
        onGone={() => gone(id)}
        onDeleted={(r) => {
          dropFromList(r.id);
          setListVersion((v) => v + 1);
          setNotice(`Deleted “${r.name}”.`);
          navigate({ view: "riffs" });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col md:h-full md:flex-row">
      <nav aria-label="Riffs" className="max-h-72 shrink-0 overflow-y-auto border-b border-gray-800 md:max-h-none md:w-64 md:border-b-0 md:border-r">
        {listError ? (
          <p role="alert" className="p-4 text-sm text-red-400">Could not load your riffs: {listError}</p>
        ) : list === null ? (
          <p className="p-4 text-sm text-gray-500">Loading riffs…</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-start gap-2 p-4 text-sm text-gray-400">
            <p>No riffs yet.</p>
            <button type="button" onClick={() => navigate({ view: "write" })} className="text-amber-400 hover:underline">
              Record one in Write →
            </button>
          </div>
        ) : (
          <ul className="flex flex-col p-2">
            {list.map((s) => {
              const selected = s.id === riffId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => select(s.id)}
                    className={`flex w-full flex-col gap-0.5 rounded-lg border-l-2 px-3 py-2 text-left ${
                      selected ? "border-amber-500 bg-gray-800" : "border-transparent hover:bg-gray-800/60"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-gray-100">{s.name}</span>
                      <RiffTag tabbed={isTabbed(s)} />
                    </span>
                    <span className="text-xs text-gray-400">
                      {s.keyRoot} {s.scale}
                    </span>
                    <span className="text-xs text-gray-500">
                      {riffShape(s)} · {day(s.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      {/* Side by side, the takes and the tab each scroll on their own; stacked, the page does. */}
      <section aria-label="Riff" className="flex min-w-0 flex-1 flex-col p-4 md:overflow-y-auto xl:overflow-hidden">
        {notice && (
          <div role="status" className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200">
            {notice}
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="px-1 text-gray-400 hover:text-white">
              ×
            </button>
          </div>
        )}
        <div className="xl:min-h-0 xl:flex-1">{detail}</div>
      </section>
    </div>
  );
}
