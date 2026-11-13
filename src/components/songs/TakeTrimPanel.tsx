"use client";

import { useState } from "react";
import { LoopCheckButton, TrimBox, type Trim } from "./TakeWaveform";
import TrimDialog from "./TrimDialog";
import { useDecodedTake, useEscapeToDiscard, useLoopCheck } from "./useTakeTrim";
import { PartGoneError, errorText } from "./riffApi";
import { detectSoundBounds } from "@/lib/songwriting/capture";
import { MIN_LOOP_SECONDS } from "@/lib/songwriting/loopCheck";
import { savedTakeTrim, trimMoved } from "@/lib/songwriting/partTakes";
import { DISCARD_TAKE_QUESTION } from "@/lib/songwriting/unsavedTake";

/** A take just recorded (only in memory until saved), or the part's saved take. */
export type TakeSource =
  | { kind: "new"; blob: Blob; mimeType: string; duration: number }
  | { kind: "saved"; url: string; trimStart: number | null; trimEnd: number | null; audioDuration: number | null };

export interface TakeTrimPanelProps {
  partName: string;
  source: TakeSource;
  /** A new take for a part with a tab: once saved, Play riff plays it instead of the tab (listenAfterNewTake). */
  replacesTab?: boolean;
  /** Something to know about the take first (it stopped by itself, say). */
  note?: string | null;
  /** Save the trim (with the take, when it is new). Rejects with what went wrong; the panel stays open. */
  onSave(trim: Trim, audioDuration: number): Promise<void>;
  /** Discard the new take, or leave the saved one as it was. */
  onClose(): void;
}

const TRIM_CHANGES_QUESTION = "Discard your changes to the trim?";

/**
 * A part's take, trimmed: the capture panel's waveform and handles (free: a
 * take is just audio, nothing snaps to bars) and the loop check. A new take is
 * saved with its trim; a saved take's trim is changed on its own (ruling 8).
 */
export default function TakeTrimPanel({ partName, source, replacesTab = false, note: takeNote, onSave, onClose }: TakeTrimPanelProps) {
  const isNew = source.kind === "new";
  const [trim, setTrim] = useState<Trim | null>(null);
  /** Where a saved take's handles started: Save is offered once they move. */
  const [initial, setInitial] = useState<Trim | null>(null);
  const [dragging, setDragging] = useState<Trim | null>(null);
  const [duration, setDuration] = useState(source.kind === "new" ? source.duration : 0);
  const [looping, setLooping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { ctxRef, take, loadError } = useDecodedTake(
    source.kind === "new" ? source.blob : source.url,
    ({ buffer, mono }) => {
      if (source.kind === "new") {
        // The handles start where the playing starts and stops.
        setDuration(buffer.duration);
        setTrim(detectSoundBounds(mono, buffer.sampleRate));
      } else {
        const saved = savedTakeTrim(source, buffer.duration);
        setDuration(saved.duration);
        setTrim(saved.trim);
        setInitial(saved.trim);
      }
    },
    isNew ? "This take couldn't be read. Discard it and record again." : "The take couldn't be loaded.",
  );

  const live = dragging ?? trim;
  const length = trim ? trim.end - trim.start : 0;
  const changed = !!trim && !!initial && trimMoved(trim, initial);
  const canSave = !!trim && !saving && length >= MIN_LOOP_SECONDS && (isNew || changed);

  const { playhead, rewind, seek } = useLoopCheck(ctxRef, looping, take, trim);
  // A new take exists only here until it is saved (the capture panel's rule);
  // a saved one only loses the handles' new places, and asks only if they moved.
  useEscapeToDiscard(saving, isNew ? DISCARD_TAKE_QUESTION : changed ? TRIM_CHANGES_QUESTION : null, onClose);

  const commitTrim = (t: Trim) => {
    setDragging(null);
    setTrim(t);
  };

  const save = async () => {
    if (!trim || !canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(trim, duration);
    } catch (err) {
      setSaveError(
        err instanceof PartGoneError
          ? "This part has been deleted, so there is nothing to save to."
          : `Could not save: ${errorText(err)}${isNew ? " The take is still here: try again." : ""}`,
      );
      setSaving(false);
    }
  };

  return (
    <TrimDialog labelledBy="take-trim-title">
      <div>
        <h2 id="take-trim-title" className="text-lg font-semibold text-white">
          {isNew ? "Keep the take" : "Trim the take"} <span className="font-normal text-gray-400">· {partName}</span>
        </h2>
        <p className="text-sm text-gray-400">Drag the edges onto exactly the part; click or drag on the waveform to move the playhead.</p>
        {takeNote && <p role="status" className="mt-1 text-sm text-amber-300">{takeNote}</p>}
      </div>

      <TrimBox take={take} loadError={loadError} trim={trim} live={live} duration={duration} onDrag={setDragging} onCommit={commitTrim} playhead={playhead} onSeek={seek} />

      <div>
        <LoopCheckButton looping={looping} disabled={!trim || length < MIN_LOOP_SECONDS} onToggle={() => setLooping((v) => !v)} onRewind={rewind} />
      </div>

      {isNew && replacesTab && <p className="text-sm text-gray-400">Play riff will play this take instead of {partName}&apos;s tab.</p>}
      {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={saving} className="px-3 py-1.5 text-sm rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40">
          {isNew ? "Discard" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-gray-900 font-semibold hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : isNew ? "Save take" : "Save trim"}
        </button>
      </div>
    </TrimDialog>
  );
}
