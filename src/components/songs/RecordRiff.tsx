"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CapturePanel from "./CapturePanel";
import { useClickTrack } from "./useClickTrack";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { recordingClick, type SessionPrefs } from "@/lib/songwriting/sessionPrefs";
import { guardUnsavedTake } from "@/lib/songwriting/unsavedTake";
import type { Riff } from "@/types";

export interface RecordRiffProps {
  session: SessionPrefs;
  onSaved(riff: Riff): void;
}

interface Take {
  blob: Blob;
  mimeType: string;
  duration: number;
  /** The session as it was when Record was pressed: the riff is a copy of the setup it was made in. */
  session: SessionPrefs;
  /** Shown with the take in the capture panel: the recording stopped by itself. */
  note?: string;
}

const INSECURE =
  "Recording needs the microphone, which the browser only allows over HTTPS. Open the app at its https:// address.";
const NOTHING_RECORDED = "Nothing was recorded. Check the audio input in the top bar's device picker.";
/** The recorder stopped with nobody asking (the input unplugged, say). */
const STOPPED_ITSELF = "The recording stopped by itself — here's what was recorded.";
const STOPPED_ITSELF_EMPTY =
  "The recording stopped by itself and nothing was recorded. Check the audio input in the top bar's device picker.";

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Record a take; Stop opens the capture panel. With a tempo set and the click
 * on, the mic opens first, then a bar is counted in and the click plays on
 * until Stop (the take keeps the count-in's silence: its handles start where
 * the playing does).
 */
export default function RecordRiff({ session, onSaved }: RecordRiffProps) {
  const { status, error, level, durationMs, start, stop } = useAudioRecorder();
  const { start: startClick, stop: stopClick, countIn } = useClickTrack();
  const clickStarted = useRef(false);
  const [take, setTake] = useState<Take | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const setup = useRef<{ session: SessionPrefs } | null>(null);
  // From Record until its take is in (or it is known there is none).
  const [underway, setUnderway] = useState(false);
  // Stop was asked: the recorder going idle is that, not it stopping by itself.
  const stopAsked = useRef(false);
  const recording = status === "recording";
  const busy = status === "requesting" || status === "stopping";
  // From Record until it is saved or discarded the take is only in memory:
  // leaving the view or the page asks first.
  const unsaved = recording || status === "stopping" || take !== null;
  useEffect(() => (unsaved ? guardUnsavedTake() : undefined), [unsaved]);

  const record = () => {
    setNote(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setNote(INSECURE);
      return;
    }
    setup.current = { session };
    clickStarted.current = false;
    stopAsked.current = false;
    setUnderway(true);
    void start();
  };

  // The count-in starts once the mic is listening, so the first note is never lost.
  useEffect(() => {
    const settings = setup.current && recordingClick(setup.current.session);
    if (!recording || !settings || clickStarted.current) return;
    clickStarted.current = true;
    startClick(settings);
  }, [recording, startClick]);

  const finish = useCallback(
    (byItself: boolean) => {
      stopClick();
      stopAsked.current = true;
      void stop().then((result) => {
        setUnderway(false);
        const started = setup.current;
        if (!started) return;
        if (!result || result.blob.size === 0) {
          if (result || byItself) setNote(byItself ? STOPPED_ITSELF_EMPTY : NOTHING_RECORDED);
          return;
        }
        setTake({ ...result, ...started, ...(byItself ? { note: STOPPED_ITSELF } : {}) });
      });
    },
    [stop, stopClick],
  );

  // The recorder went idle mid-take with no Stop asked: it stopped by itself
  // (the input unplugged, say). What it recorded opens in the capture panel.
  const stranded = underway && status === "idle";
  useEffect(() => {
    if (stranded && !stopAsked.current) finish(true);
  }, [stranded, finish]);

  const discard = useCallback(() => setTake(null), []);
  const saved = useCallback(
    (riff: Riff) => {
      setTake(null);
      onSaved(riff);
    },
    [onSaved],
  );

  const message = note ?? error;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={recording ? () => finish(false) : record}
        className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
          recording ? "bg-red-600 text-white hover:bg-red-500" : "bg-amber-600 text-gray-900 hover:bg-amber-500"
        }`}
      >
        {recording ? "■ Stop recording" : status === "requesting" ? "Opening the mic…" : status === "stopping" ? "Finishing…" : "● Record riff"}
      </button>
      {recording && countIn !== null && (
        <div className="flex items-baseline gap-2" role="status" aria-label={`Count-in: ${countIn}`}>
          <span className="text-4xl font-bold tabular-nums text-amber-400" aria-hidden>{countIn}</span>
          <span className="text-xs text-gray-400" aria-hidden>count-in — start on the next 1</span>
        </div>
      )}
      {recording && countIn === null && (
        <div className="flex items-center gap-2" role="status" aria-label={`Recording, ${clock(durationMs)}`}>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
          <span className="font-mono text-sm text-gray-200 tabular-nums" aria-hidden>{clock(durationMs)}</span>
          <div className="flex-1 min-w-0 h-2 bg-gray-700 rounded overflow-hidden" title="Input level" aria-hidden>
            <div className="h-full bg-green-500" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        </div>
      )}
      {!recording && !message && (
        <p className="text-xs text-gray-500">
          {recordingClick(session)
            ? "Counts in one bar, then clicks while you play. The riff keeps this tempo."
            : "Just audio: trim it afterwards, and tap its tempo when you tab it out."}
        </p>
      )}
      {message && <p role="alert" className="text-sm text-red-400">{message}</p>}
      {take && (
        <CapturePanel
          blob={take.blob}
          mimeType={take.mimeType}
          duration={take.duration}
          session={take.session}
          note={take.note}
          onSaved={saved}
          onDiscard={discard}
        />
      )}
    </div>
  );
}
