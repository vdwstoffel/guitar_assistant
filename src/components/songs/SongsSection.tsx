"use client";

import { Suspense, useCallback, useRef, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WriteView from "./WriteView";
import RiffsView from "./RiffsView";
import SongsPanel from "./SongsView";
import { songsHref, type SongsLocation, type SongsView } from "@/lib/songwriting/riffView";
import { mayLeaveTake } from "@/lib/songwriting/unsavedTake";

const VIEWS: { id: SongsView; label: string }[] = [
  { id: "write", label: "Write" },
  { id: "riffs", label: "Riffs" },
  { id: "songs", label: "Songs" },
];

const tabId = (v: SongsView) => `songs-tab-${v}`;
const panelId = (v: SongsView) => `songs-panel-${v}`;

function SongsSectionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const view = VIEWS.find((v) => v.id === params.get("view"))?.id ?? "write";
  const tabs = useRef(new Map<SongsView, HTMLButtonElement>());

  const navigate = useCallback((loc: SongsLocation) => router.replace(songsHref(loc)), [router]);
  /** Open another view; leaving Write with a take not yet saved asks first. */
  const openView = (target: SongsView): boolean => {
    if (target === view) return true;
    if (!mayLeaveTake()) return false;
    navigate({ view: target });
    return true;
  };

  // Arrow keys, Home and End move between the tabs (and open the one reached).
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = VIEWS.findIndex((v) => v.id === view);
    const next =
      e.key === "ArrowRight" ? (i + 1) % VIEWS.length
      : e.key === "ArrowLeft" ? (i - 1 + VIEWS.length) % VIEWS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? VIEWS.length - 1
      : null;
    if (next === null) return;
    e.preventDefault();
    const target = VIEWS[next].id;
    if (openView(target)) tabs.current.get(target)?.focus();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gray-900 text-gray-100">
      <div role="tablist" aria-label="Songs views" onKeyDown={onTabKey} className="flex shrink-0 gap-1 px-4 pt-3 border-b border-gray-800">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            ref={(el) => {
              if (el) tabs.current.set(v.id, el);
              else tabs.current.delete(v.id);
            }}
            id={tabId(v.id)}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            // Only the open view's panel is in the page.
            aria-controls={view === v.id ? panelId(v.id) : undefined}
            tabIndex={view === v.id ? 0 : -1}
            onClick={() => openView(v.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md ${view === v.id ? "bg-gray-800 text-white border-b-2 border-amber-500" : "text-gray-400 hover:text-white"}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId(view)} aria-labelledby={tabId(view)} className="flex-1 min-h-0 overflow-y-auto">
        {view === "write" ? (
          <WriteView />
        ) : view === "songs" ? (
          <SongsPanel songId={params.get("song")} navigate={navigate} />
        ) : (
          <RiffsView riffId={params.get("riff")} partId={params.get("part")} navigate={navigate} />
        )}
      </div>
    </div>
  );
}

/** The Songs section: a switch between its views, Write, Riffs and Songs. */
export default function SongsSection() {
  return (
    <Suspense fallback={null}>
      <SongsSectionInner />
    </Suspense>
  );
}
