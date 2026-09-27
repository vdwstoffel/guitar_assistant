"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TabPicker, { type TabPickerEntry } from "./TabPicker";
import TabEditor from "./TabEditor";
import { emptyTabTex } from "@/lib/tabscore/emptyTab";
import type { TrackTab } from "@/types";

// A minimal but valid AlphaTex document: a tempo header, the track
// separator, and one bar of rests. `parseTex` (see @/lib/tabscore/parse)
// rejects an empty string outright, so a freshly-created tab (alphatex:
// null, or emptied out by a user) needs something parseable to hand
// TabEditor rather than nothing at all.


/**
 * Self-contained "Tabs" section: fetches the flat list of every TrackTab
 * (grouped by track in TabPicker), fetches the selected tab's full record on
 * selection, and renders TabEditor for it. Mirrors the zero-prop,
 * self-fetching pattern already used for Tools/RecordingsView/
 * CircleOfFifths in page.tsx, since this section shares no state with the
 * rest of the app (no now-playing/BottomPlayer integration).
 */
export default function TabsSection() {
  const [entries, setEntries] = useState<TabPickerEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TrackTab | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEntriesLoading(true);
      try {
        const res = await fetch("/api/tabs");
        if (!res.ok) throw new Error("Failed to fetch tabs");
        const data: TabPickerEntry[] = await res.json();
        if (!cancelled) setEntries(data);
      } catch (err) {
        console.error("Error fetching tabs:", err);
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  // Fetch the full tab (including `alphatex`) for whichever entry is
  // selected. The picker only carries id/name/trackId/trackTitle, per the
  // GET /api/tabs contract, so the source text comes from the per-track
  // tabs endpoint the brief specifies: /api/tracks/[id]/tabs.
  useEffect(() => {
    if (!selectedEntry) {
      setSelectedTab(null);
      setTabError(false);
      return;
    }
    let cancelled = false;
    setTabLoading(true);
    setTabError(false);
    (async () => {
      try {
        const res = await fetch(`/api/tracks/${selectedEntry.trackId}/tabs`);
        if (!res.ok) throw new Error("Failed to fetch tab");
        const data: TrackTab[] = await res.json();
        if (cancelled) return;
        const tab = data.find((t) => t.id === selectedEntry.id) ?? null;
        setSelectedTab(tab);
        if (!tab) setTabError(true);
      } catch (err) {
        console.error("Error loading tab:", err);
        if (!cancelled) setTabError(true);
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEntry]);

  // The route the brief names ("PUTs to .../tabs/[tabId]") doesn't actually
  // exist: src/app/api/tracks/[id]/tabs/[tabId]/route.ts only implements
  // PATCH and DELETE. PATCH is what's used here — a PUT would 405.
  const handleSave = useCallback(
    async (patch: { alphatex: string; playbackSpeed: number }) => {
      if (!selectedEntry) return;
      const res = await fetch(
        `/api/tracks/${selectedEntry.trackId}/tabs/${selectedEntry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      if (!res.ok) throw new Error("Failed to save tab");
    },
    [selectedEntry],
  );

  // True whenever `selectedTab` still holds the PREVIOUSLY selected tab's
  // data (or none yet) rather than the one `selectedId` now points at. The
  // fetch above is async, so without this guard a one-frame flash of the
  // old tab's content is possible between the id changing and its effect
  // resolving; folding the mismatch into "still loading" avoids it.
  const isTabStale = tabLoading || (selectedTab !== null && selectedTab.id !== selectedId);

  return (
    <div className="h-full flex overflow-hidden bg-gray-900">
      <div className="w-64 shrink-0 border-r border-gray-700 overflow-y-auto">
        <TabPicker entries={entries} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="flex-1 min-w-0 min-h-0 p-4">
        {entriesLoading ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            Loading tabs…
          </div>
        ) : !selectedId ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            Select a tab to get started
          </div>
        ) : isTabStale ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            Loading…
          </div>
        ) : tabError || !selectedTab ? (
          <div className="h-full flex items-center justify-center text-red-400">
            Could not load this tab
          </div>
        ) : (
          <TabEditor
            key={selectedTab.id}
            initialTex={
              selectedTab.alphatex && selectedTab.alphatex.trim() !== ""
                ? selectedTab.alphatex
                : emptyTabTex(selectedTab.tempo)
            }
            initialSpeed={selectedTab.playbackSpeed}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
