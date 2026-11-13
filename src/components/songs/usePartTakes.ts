"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { guardUnsavedTake } from "@/lib/songwriting/unsavedTake";

/** A take just recorded for a part, waiting in the trim panel to be saved or discarded. */
export interface NewTake {
  partId: string;
  blob: Blob;
  mimeType: string;
  duration: number;
  /** Shown with the take in the trim panel: the recording stopped by itself. */
  note?: string;
}

export interface PartTakes {
  /** The part whose take is being recorded (from Record until Stop has the take); null otherwise. */
  recordingPartId: string | null;
  /** Where that recording is: the mic opening, recording (the guide plays), or the take being finished. */
  stage: "opening" | "recording" | "finishing" | null;
  /** Input level 0-1 and time recorded, while recording. */
  level: number;
  durationMs: number;
  /** The take waiting in the trim panel. */
  take: NewTake | null;
  /** A take is being recorded or waits to be saved: there is something to lose. */
  active: boolean;
  /** Why the last Record did not work, or why it kept nothing. */
  message: string | null;
  record(partId: string): void;
  /** Stop recording: the take goes to the trim panel. */
  stop(): void;
  /** Done with the take (saved, or to be lost): stop recording without keeping it, or drop the one waiting. */
  clear(): void;
}

type Phase = { kind: "recording"; partId: string } | { kind: "take"; take: NewTake } | null;

const INSECURE =
  "Recording needs the microphone, which the browser only allows over HTTPS. Open the app at its https:// address.";
const NOTHING_RECORDED = "Nothing was recorded. Check the audio input in the top bar's device picker.";
/** The recorder stopped with nobody asking (the input unplugged, say). */
const STOPPED_ITSELF = "The recording stopped by itself — here's what was recorded.";
const STOPPED_ITSELF_EMPTY =
  "The recording stopped by itself and nothing was recorded. Check the audio input in the top bar's device picker.";

/**
 * Recording a take for one of a riff's parts — one at a time in the whole
 * Riffs view. From Record until the take is saved or discarded it exists only
 * in memory, so it is guarded like the Write view's (unsavedTake.ts): a reload
 * or a link out asks first, and the view's own ways out call `mayLeaveTake`.
 */
export function usePartTakes(): PartTakes {
  const recorder = useAudioRecorder();
  const [phase, setPhase] = useState<Phase>(null);
  const [note, setNote] = useState<string | null>(null);
  // Each Record is a new attempt; a Stop that resolves for an older (discarded) one keeps nothing.
  const attempt = useRef(0);
  // Stop (or discard) was asked for this attempt: the recorder going idle is that, not it stopping by itself.
  const stopAsked = useRef(false);
  const { status } = recorder;

  // A Record that never got the mic (refused, no device) or a recorder that failed holds nothing.
  const current = phase?.kind === "recording" && status === "error" ? null : phase;
  const recordingPartId = current?.kind === "recording" ? current.partId : null;
  const take = current?.kind === "take" ? current.take : null;
  const active = current !== null;
  useEffect(() => (active ? guardUnsavedTake() : undefined), [active]);

  const { start, stop: stopRecorder } = recorder;
  // Discarded while the mic was still opening: it opens anyway, so close it again at once.
  const orphan = status === "recording" && recordingPartId === null;
  useEffect(() => {
    if (orphan) void stopRecorder();
  }, [orphan, stopRecorder]);

  const record = useCallback(
    (partId: string) => {
      setNote(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setNote(INSECURE);
        return;
      }
      attempt.current += 1;
      stopAsked.current = false;
      setPhase({ kind: "recording", partId });
      void start();
    },
    [start],
  );

  /** Take what the recorder has: into the trim panel, or nothing (with a note why). */
  const finish = useCallback(
    (partId: string, byItself: boolean) => {
      stopAsked.current = true;
      const mine = attempt.current;
      void stopRecorder().then((result) => {
        if (attempt.current !== mine) return; // discarded meanwhile
        if (!result || result.blob.size === 0) {
          setPhase(null);
          if (result || byItself) setNote(byItself ? STOPPED_ITSELF_EMPTY : NOTHING_RECORDED);
          return;
        }
        setPhase({ kind: "take", take: { partId, ...result, ...(byItself ? { note: STOPPED_ITSELF } : {}) } });
      });
    },
    [stopRecorder],
  );

  const stop = useCallback(() => {
    if (phase?.kind !== "recording") return;
    finish(phase.partId, false);
  }, [phase, finish]);

  // The recorder went idle while recording with no Stop asked: it stopped by
  // itself (the input unplugged, say). Its take is kept: it goes to the trim
  // panel like any other, instead of the part sticking at "finishing".
  const stoppedItself = phase?.kind === "recording" && status === "idle";
  const strandedPartId = stoppedItself ? phase.partId : null;
  useEffect(() => {
    if (strandedPartId !== null && !stopAsked.current) finish(strandedPartId, true);
  }, [strandedPartId, finish]);

  const clear = useCallback(() => {
    attempt.current += 1;
    stopAsked.current = true;
    if (status === "requesting" || status === "recording") void stopRecorder();
    setPhase(null);
  }, [status, stopRecorder]);

  return {
    recordingPartId,
    stage:
      recordingPartId === null ? null
      : status === "recording" ? "recording"
      : status === "stopping" || status === "idle" ? "finishing"
      : "opening",
    level: recorder.level,
    durationMs: recorder.durationMs,
    take,
    active,
    message: note ?? recorder.error,
    record,
    stop,
    clear,
  };
}
