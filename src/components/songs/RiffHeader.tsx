"use client";

import type { ReactNode } from "react";
import DraftInput from "./DraftInput";
import TapButton from "./TapButton";
import { NOTES, SCALE_FORMULAS } from "@/lib/musicTheory";
import { SESSION_TUNING_IDS, tuningLabel } from "@/lib/songwriting/tunings";
import { parseDraft, type DraftField } from "@/lib/songwriting/riffView";
import type { RiffPatch } from "@/lib/songwriting/riffs";
import type { Riff } from "@/types";

const SCALES = Object.keys(SCALE_FORMULAS).filter((s) => s !== "None");
const DENOMINATORS = [1, 2, 4, 8, 16];
const FIELD = "flex flex-col gap-1 text-[11px] uppercase tracking-wide text-gray-400";
const SELECT =
  "bg-gray-700 text-gray-100 text-sm normal-case tracking-normal rounded-lg px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-amber-500";
const NUMBER = "w-16 text-center normal-case tracking-normal";

const label = (id: string) => {
  try {
    return tuningLabel(id);
  } catch {
    return id;
  }
};

interface RiffHeaderProps {
  riff: Riff;
  onSave(fields: RiffPatch): void;
  /** Shown beside the name: saving, or why a save failed. */
  status?: ReactNode;
}

/** The riff's name, key, scale, tuning, tempo, time signature and bars, each saved as it changes. */
export default function RiffHeader({ riff, onSave, status }: RiffHeaderProps) {
  // A tab can switch the riff to a tuning the session does not offer (Open G, say): keep it listed.
  const tunings = SESSION_TUNING_IDS.includes(riff.tuning) ? SESSION_TUNING_IDS : [...SESSION_TUNING_IDS, riff.tuning];
  const draft = (field: DraftField) => ({
    parse: (text: string) => parseDraft(field, text),
    onCommit: (v: string | number) => onSave({ [field]: v }),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <DraftInput
          aria-label="Riff name"
          value={riff.name}
          maxLength={80}
          {...draft("name")}
          className="w-full max-w-md text-lg font-bold"
        />
        <div className="text-sm">{status}</div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className={FIELD}>
          Key
          <select value={riff.keyRoot} onChange={(e) => onSave({ keyRoot: e.target.value })} className={SELECT}>
            {NOTES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          Scale
          <select value={riff.scale} onChange={(e) => onSave({ scale: e.target.value })} className={SELECT}>
            {SCALES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          Tuning
          <select value={riff.tuning} onChange={(e) => onSave({ tuning: e.target.value })} className={SELECT}>
            {tunings.map((t) => (
              <option key={t} value={t}>{label(t)}</option>
            ))}
          </select>
        </label>
        <div className={FIELD}>
          <span aria-hidden>Tempo{riff.tempo === null && <span className="normal-case tracking-normal text-amber-400"> · tap it</span>}</span>
          <span className="flex items-center gap-1.5 normal-case tracking-normal">
            <DraftInput
              aria-label="Tempo (BPM)"
              inputMode="numeric"
              value={riff.tempo === null ? "" : String(riff.tempo)}
              placeholder="—"
              {...draft("tempo")}
              className={NUMBER}
            />
            <span className="text-xs text-gray-500">BPM</span>
            <TapButton onTempo={(tempo) => onSave({ tempo })} />
          </span>
        </div>
        <fieldset className={FIELD}>
          <legend className="mb-1">Time signature</legend>
          <span className="flex items-center gap-1.5 normal-case tracking-normal">
            <DraftInput aria-label="Beats per bar" inputMode="numeric" value={String(riff.tsNum)} {...draft("tsNum")} className="w-12 text-center" />
            <span className="text-gray-500" aria-hidden>/</span>
            <select
              aria-label="Beat unit"
              value={riff.tsDen}
              onChange={(e) => onSave({ tsDen: Number(e.target.value) })}
              className={SELECT}
            >
              {DENOMINATORS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </span>
        </fieldset>
      </div>
      <p className="text-xs text-gray-500">
        Play a take and click Tap on every beat: when you stop, that is the riff&apos;s tempo. Tempo and tuning go into the tab below at
        once, and into the other parts&apos; tabs when they are next shown. The time signature is the shape of a new tab; it never
        rewrites one that exists.
      </p>
    </div>
  );
}
