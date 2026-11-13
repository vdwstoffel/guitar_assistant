"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { routeContextToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
import { monoSamples } from "@/lib/songwriting/capture";
import { loopPosition, startLoopCheck } from "@/lib/songwriting/loopCheck";
import { captureEscapeAction } from "@/lib/songwriting/unsavedTake";

/** A take ready to trim: its file, its audio, and the audio as one channel (the waveform and the sound finder use it). */
export interface DecodedTake {
  blob: Blob;
  buffer: AudioBuffer;
  mono: Float32Array;
}

/**
 * A trim panel's own audio context, routed to the output device: it decodes
 * the take — a Blob just recorded, or the URL of a saved one — and later plays
 * the loop check; it closes with the panel. `onDecoded` (called once, with the
 * take) places the handles. `failure` is what to say when it cannot be read.
 */
export function useDecodedTake(
  source: Blob | string,
  onDecoded: (take: DecodedTake) => void,
  failure: string,
): { ctxRef: RefObject<AudioContext | null>; take: DecodedTake | null; loadError: string | null } {
  const ctxRef = useRef<AudioContext | null>(null);
  const [take, setTake] = useState<DecodedTake | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const latest = useRef(onDecoded);
  useEffect(() => {
    latest.current = onDecoded;
  });

  useEffect(() => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    void routeContextToSink(ctx);
    const unsubscribe = subscribeToAudioSinkChanges(() => void routeContextToSink(ctx));
    let alive = true;
    const file =
      typeof source === "string"
        ? fetch(source).then((res) => {
            if (!res.ok) throw new Error(`The server said ${res.status}`);
            return res.blob();
          })
        : Promise.resolve(source);
    file
      .then(async (blob) => {
        const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
        if (!alive) return;
        const mono = monoSamples(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)));
        const decoded = { blob, buffer, mono };
        setTake(decoded);
        latest.current(decoded);
      })
      .catch(() => alive && setLoadError(failure));
    return () => {
      alive = false;
      unsubscribe();
      ctxRef.current = null;
      void ctx.close().catch(() => {});
    };
  }, [source, failure]);

  return { ctxRef, take, loadError };
}

/**
 * The loop check (loopCheck.ts) while `on`. Turned off it pauses: the
 * playhead stays where it got to, and turned on again it carries on from
 * there (from the trim start if the handles have moved past it). A change of
 * handles while playing carries on from where it is, too. Returns the
 * playhead: where in the take (seconds) the sound being heard is, null until
 * it first plays or is placed (`seek`, `rewind`). A ref, so the waveform can follow it without the panel
 * rendering 60 times a second.
 */
export function useLoopCheck(
  ctxRef: RefObject<AudioContext | null>,
  on: boolean,
  take: DecodedTake | null,
  trim: { start: number; end: number } | null,
): { playhead: RefObject<number | null>; rewind(): void; seek(time: number): void } {
  const playhead = useRef<number | null>(null);
  // Back to the trim start: bumped, the loop (if playing) starts again from there.
  const [restarts, setRestarts] = useState(0);
  const trimStart = useRef(trim?.start ?? null);
  useEffect(() => {
    trimStart.current = trim?.start ?? null;
  });
  // A new take starts from nothing.
  useEffect(() => {
    playhead.current = null;
  }, [take]);
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!on || !ctx || !take || !trim) return;
    const loop = startLoopCheck(ctx, take.buffer, trim, playhead.current ?? trim.start);
    if (!loop) return;
    let frame = 0;
    const follow = () => {
      // The context time of the sample reaching the speakers now (output latency allowed for).
      const heard = ctx.getOutputTimestamp?.().contextTime ?? ctx.currentTime;
      playhead.current = loopPosition(heard, loop.t0, trim, loop.from);
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(frame);
      loop.stop(); // the playhead stays where it got to: paused there
    };
  }, [ctxRef, on, take, trim, restarts]);
  const rewind = useCallback(() => {
    playhead.current = trimStart.current;
    setRestarts((n) => n + 1);
  }, []);
  // Put the playhead at `time`: playing, the loop carries on from there (from the trim start when it is outside the kept part).
  const seek = useCallback((time: number) => {
    playhead.current = Math.max(0, time);
    setRestarts((n) => n + 1);
  }, []);
  return { playhead, rewind, seek };
}

/**
 * Escape in a trim panel: in a box it only drops what is typed there (each box
 * does that itself); anywhere else it asks `question` and, on yes, calls
 * `onDiscard` — or with no question (nothing to lose) just calls it. Nothing
 * while saving (unsavedTake.ts's `captureEscapeAction`).
 */
export function useEscapeToDiscard(saving: boolean, question: string | null, onDiscard: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const targetTag = e.target instanceof Element ? e.target.tagName : null;
      if (captureEscapeAction({ key: e.key, repeat: e.repeat, isComposing: e.isComposing, targetTag }, saving) !== "ask-discard") return;
      e.preventDefault();
      if (question === null || window.confirm(question)) onDiscard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, question, onDiscard]);
}
