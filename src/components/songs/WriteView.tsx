"use client";

import { useCallback, useMemo, useState } from "react";
import SessionHeader from "./SessionHeader";
import RecordRiff from "./RecordRiff";
import ClickSettings from "./ClickSettings";
import ProgressionEditor from "./ProgressionEditor";
import SongFretboard from "./SongFretboard";
import IntervalLegend from "./IntervalLegend";
import RecentRiffs from "./RecentRiffs";
import Link from "next/link";
import { useSessionPrefs } from "./useSessionPrefs";
import { songsHref } from "@/lib/songwriting/riffView";
import { chordName, chordPitchClasses, suggestedChords } from "@/lib/songwriting/theory";
import type { Riff } from "@/types";

const PANEL = "bg-gray-800 border border-gray-700 rounded-xl p-3";
const LABEL = "text-[11px] uppercase tracking-wide text-gray-400";
/** The writing screen: key, chords, and the scale lit by the chord picked. */
export default function WriteView() {
  const [prefs, setPrefs] = useSessionPrefs();
  const [selected, setSelected] = useState(0);

  const { progression } = prefs;
  // The riff just saved (a link straight to tabbing it out), and the strip of recent riffs refetching.
  const [saved, setSaved] = useState<Riff | null>(null);
  const [riffsVersion, setRiffsVersion] = useState(0);
  const onRiffSaved = useCallback((riff: Riff) => {
    setSaved(riff);
    setRiffsVersion((v) => v + 1);
  }, []);
  const refIndex = Math.min(selected, Math.max(0, progression.length - 1));
  const refChord = progression[refIndex];
  const referenceRoot = refChord ? refChord.root : prefs.keyRoot;
  const chordPcs = useMemo(() => (refChord ? chordPitchClasses(refChord) : []), [refChord]);
  const fits = useMemo(() => suggestedChords(prefs.keyRoot, prefs.scale).filter((c) => c.quality !== "Power").map(chordName), [prefs.keyRoot, prefs.scale]);

  return (
    <div className="relative flex flex-col gap-3 p-4 max-w-6xl mx-auto w-full">
      <SessionHeader
        keyRoot={prefs.keyRoot}
        scale={prefs.scale}
        tuning={prefs.tuning}
        onKeyChange={(keyRoot) => setPrefs({ keyRoot })}
        onScaleChange={(scale) => setPrefs({ scale })}
        onTuningChange={(tuning) => setPrefs({ tuning })}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
        <div className={PANEL}>
          <div className={`${LABEL} mb-2`}>Chord progression · click a chord to light it on the fretboard</div>
          <ProgressionEditor
            keyRoot={prefs.keyRoot}
            scale={prefs.scale}
            progression={progression}
            onChange={(next) => setPrefs({ progression: next })}
            selectedIndex={refIndex}
            onSelect={setSelected}
          />
          <p className="mt-2 text-sm text-gray-400">
            {progression.length === 0 ? "No chords yet — add one to see its notes lit on the fretboard. " : ""}
            Chords that fit {prefs.keyRoot} {prefs.scale}: {fits.join(" · ")}
          </p>
        </div>

        <div className={`${PANEL} flex flex-col justify-center gap-2`}>
          <div className={LABEL}>Got something?</div>
          <ClickSettings prefs={prefs} onChange={setPrefs} />
          <RecordRiff session={prefs} onSaved={onRiffSaved} />
          {saved && (
            <p role="status" className="text-sm text-green-400">
              Saved “{saved.name}”.{" "}
              {saved.parts[0] && (
                <Link href={songsHref({ view: "riffs", riff: saved.id, part: saved.parts[0].id })} className="text-amber-400 hover:underline">
                  Tab it out →
                </Link>
              )}
            </p>
          )}
        </div>
      </div>

      <div className={PANEL}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-gray-300">
            {prefs.keyRoot} {prefs.scale}
            {refChord ? <> · <span className="text-amber-300">{chordName(refChord)}</span> — its notes are lit</> : " · add a chord to light its notes"}
          </div>
          <div className="inline-flex border border-gray-600 rounded-lg overflow-hidden text-sm" role="group" aria-label="Fretboard labels">
            {(["intervals", "notes"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={prefs.labelMode === m}
                onClick={() => setPrefs({ labelMode: m })}
                className={`px-3 py-1 ${prefs.labelMode === m ? "bg-amber-600 text-gray-900 font-semibold" : "text-gray-300 hover:bg-gray-700"}`}
              >
                {m === "intervals" ? "Intervals" : "Notes"}
              </button>
            ))}
          </div>
        </div>
        <SongFretboard tuning={prefs.tuning} keyRoot={prefs.keyRoot} scale={prefs.scale} referenceRoot={referenceRoot} chordPcs={chordPcs} labelMode={prefs.labelMode} />
        <IntervalLegend referenceRoot={referenceRoot} scale={prefs.scale} keyRoot={prefs.keyRoot} chordPcs={chordPcs} />
      </div>

      <RecentRiffs refreshKey={riffsVersion} />
    </div>
  );
}
