"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { routeContextToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
import { countInAt, startClickTrack } from "@/lib/songwriting/clickTrack";

export interface ClickSettings {
  tempo: number;
  tsNum: number;
  tsDen: number;
}

/**
 * The recording click on its own audio context, on the chosen output device:
 * `start` counts a bar in and clicks on until `stop` (or unmount). `countIn`
 * is the count-in number showing, null outside the count-in.
 */
export function useClickTrack(): { start(settings: ClickSettings): void; stop(): void; countIn: number | null } {
  const ctxRef = useRef<AudioContext | null>(null);
  const running = useRef<(() => void) | null>(null);
  const frame = useRef(0);
  const [countIn, setCountIn] = useState<number | null>(null);

  const stop = useCallback(() => {
    running.current?.();
    running.current = null;
    cancelAnimationFrame(frame.current);
    setCountIn(null);
  }, []);

  const start = useCallback(
    (settings: ClickSettings) => {
      stop();
      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = new AudioContext();
        ctxRef.current = ctx;
        void routeContextToSink(ctx);
      }
      const clock = ctx;
      const track = startClickTrack(clock, settings);
      running.current = track.stop;
      const countInEnd = track.t0 + settings.tsNum * track.beatSeconds;
      const show = () => {
        setCountIn(countInAt(clock.currentTime, track.t0, track.beatSeconds, settings.tsNum));
        if (clock.currentTime < countInEnd) frame.current = requestAnimationFrame(show);
      };
      frame.current = requestAnimationFrame(show);
    },
    [stop],
  );

  useEffect(() => {
    const unsubscribe = subscribeToAudioSinkChanges(() => {
      if (ctxRef.current) void routeContextToSink(ctxRef.current);
    });
    return () => {
      unsubscribe();
      stop();
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [stop]);

  return { start, stop, countIn };
}
