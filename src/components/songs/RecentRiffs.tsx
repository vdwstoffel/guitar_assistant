"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RiffTag from "./RiffTag";
import { errorText, listRiffs } from "./riffApi";
import { isTabbed, riffShape, songsHref, tabLink } from "@/lib/songwriting/riffView";
import type { RiffSummary } from "@/types";

const SHOWN = 6;
const CARD = "bg-gray-800 border border-gray-700 rounded-xl p-3";

/** The newest riffs as cards under the Write view, each a click from its tab. */
export default function RecentRiffs({ refreshKey }: { refreshKey: number }) {
  const [riffs, setRiffs] = useState<RiffSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listRiffs().then(
      (all) => {
        if (!live) return;
        setRiffs(all.slice(0, SHOWN));
        setError(null);
      },
      (err: unknown) => {
        if (live) setError(errorText(err));
      },
    );
    return () => {
      live = false;
    };
  }, [refreshKey]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Recent riffs</div>
        <Link href={songsHref({ view: "riffs" })} className="text-sm text-amber-400 hover:underline">
          All riffs →
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-400">Could not load your riffs: {error}</p>
      ) : riffs === null ? null : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {riffs.map((r) => {
            const tab = tabLink(r);
            return (
              <li key={r.id} className={`${CARD} flex flex-col gap-2`}>
                <div className="flex items-center justify-between gap-2">
                  <Link href={songsHref({ view: "riffs", riff: r.id })} className="truncate font-semibold text-gray-100 hover:text-amber-300 hover:underline">
                    {r.name}
                  </Link>
                  <RiffTag tabbed={isTabbed(r)} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-gray-400">
                    {riffShape(r)} · {r.keyRoot} {r.scale}
                  </span>
                  {tab && (
                    <Link
                      href={songsHref({ view: "riffs", riff: r.id, part: tab.partId })}
                      aria-label={`${tab.label}: ${r.name}`}
                      className="rounded-lg border border-amber-800 px-3 py-1 text-sm font-medium text-amber-400 hover:bg-amber-950"
                    >
                      {tab.label}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
          {riffs.length < SHOWN && (
            <li className={`${CARD} flex items-center justify-center border-dashed text-sm text-gray-400`}>
              {riffs.length === 0 ? "Record a riff and it lands here" : "Your next riff lands here"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
