"use client";

import { useState } from "react";
import { LoopCheckButton, TrimBox, type Trim } from "./TakeWaveform";
import TrimDialog from "./TrimDialog";
import { useDecodedTake, useEscapeToDiscard, useLoopCheck } from "./useTakeTrim";
import { detectSoundBounds } from "@/lib/songwriting/capture";
import { MIN_LOOP_SECONDS } from "@/lib/songwriting/loopCheck";
import { DISCARD_TAKE_QUESTION } from "@/lib/songwriting/unsavedTake";
import { recordingClick, type SessionPrefs } from "@/lib/songwriting/sessionPrefs";
import type { Riff } from "@/types";

export interface CapturePanelProps {
  blob: Blob;
  mimeType: string;
  duration: number;
  session: SessionPrefs;
  /** Something to know about the take first (it stopped by itself, say). */
  note?: string | null;
  onSaved(riff: Riff): void;
  onDiscard(): void;
}

const FIELD = "bg-gray-700 text-gray-100 text-sm rounded-lg px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-amber-500";
const LABEL = "flex flex-col gap-1 text-[11px] uppercase tracking-wide text-gray-400";

/**
 * After Stop: trim the take to the riff, check the loop, name it, save it.
 * Recorded to the click, the riff keeps the click's tempo and time signature;
 * otherwise it is just audio, its tempo tapped later on the riff's page.
 */
export default function CapturePanel({ blob, mimeType, duration: recordedDuration, session, note, onSaved, onDiscard }: CapturePanelProps) {
  const [trim, setTrim] = useState<Trim | null>(null);
  const [dragging, setDragging] = useState<Trim | null>(null);
  const [name, setName] = useState("");
  const [looping, setLooping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const click = recordingClick(session);

  // The panel's own audio context decodes the take and plays the loop check. The handles start where the playing starts and stops.
  const { ctxRef, take, loadError } = useDecodedTake(
    blob,
    ({ buffer, mono }) => setTrim(detectSoundBounds(mono, buffer.sampleRate)),
    "This take couldn't be read. Discard it and record again.",
  );
  const duration = take?.buffer.duration ?? recordedDuration;

  const live = dragging ?? trim;
  const length = trim ? trim.end - trim.start : 0;
  const canSave = !!trim && !saving && length >= MIN_LOOP_SECONDS;

  const { playhead, rewind, seek } = useLoopCheck(ctxRef, looping, take, trim);

  // The take exists only here until it is saved: Escape in a box only drops
  // what is typed there (each box does that itself); anywhere else it asks.
  useEscapeToDiscard(saving, DISCARD_TAKE_QUESTION, onDiscard);

  const commitTrim = (t: Trim) => {
    setDragging(null);
    setTrim(t);
  };

  const save = async () => {
    if (!trim || !canSave) return;
    setSaving(true);
    setSaveError(null);
    const meta = {
      name: name.trim() || null,
      keyRoot: session.keyRoot,
      scale: session.scale,
      tuning: session.tuning,
      progression: session.progression,
      ...(click ?? {}),
      trimStart: trim.start,
      trimEnd: trim.end,
      audioDuration: duration,
    };
    const body = new FormData();
    body.append("file", blob.type ? blob : new Blob([blob], { type: mimeType }), "take");
    body.append("meta", JSON.stringify(meta));
    try {
      const res = await fetch("/api/riffs", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        onSaved(json as Riff);
        return;
      }
      setSaveError(json?.error ?? `Saving failed (${res.status})`);
    } catch {
      setSaveError("Couldn't reach the app to save. The take is still here: try again.");
    }
    setSaving(false);
  };

  return (
    <TrimDialog labelledBy="capture-title">
      <div>
        <h2 id="capture-title" className="text-lg font-semibold text-white">Keep the riff</h2>
        <p className="text-sm text-gray-400">
          Drag the edges onto exactly the riff; click or drag on the waveform to move the playhead.{" "}
          {click
            ? `Recorded to the click at ${click.tempo} BPM in ${click.tsNum}/${click.tsDen}: the riff keeps that tempo.`
            : "Its tempo can wait: you tap it on the riff's page when you tab it out."}
        </p>
        {note && <p role="status" className="mt-1 text-sm text-amber-300">{note}</p>}
      </div>

      <TrimBox take={take} loadError={loadError} trim={trim} live={live} duration={duration} onDrag={setDragging} onCommit={commitTrim} playhead={playhead} onSeek={seek} />

      <div>
        <LoopCheckButton looping={looping} disabled={!trim || length < MIN_LOOP_SECONDS} onToggle={() => setLooping((v) => !v)} onRewind={rewind} />
      </div>

      <label className={LABEL}>
        Name
        <input
          type="text"
          value={name}
          maxLength={80}
          autoFocus
          placeholder="Leave blank for “Riff N”"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void save()}
          className={`${FIELD} w-full normal-case tracking-normal placeholder-gray-500`}
        />
      </label>

      {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDiscard} disabled={saving} className="px-3 py-1.5 text-sm rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40">
          Discard
        </button>
        <button type="button" onClick={() => void save()} disabled={!canSave} className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-gray-900 font-semibold hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? "Saving…" : "Save riff"}
        </button>
      </div>
    </TrimDialog>
  );
}
