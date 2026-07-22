"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";

export interface RecordingWaveformHandle {
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
}

interface Props {
  audioUrl: string;
  onPlay?: () => void;
  onPause?: () => void;
  onFinish?: () => void;
  onReady?: (duration: number) => void;
}

const RecordingWaveform = forwardRef<RecordingWaveformHandle, Props>(
  ({ audioUrl, onPlay, onPause, onFinish, onReady }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WaveSurfer | null>(null);
    const [shouldLoad, setShouldLoad] = useState(false);

    // Callbacks change identity on every parent render. Keep the latest in a
    // ref so the WaveSurfer effect doesn't tear down/recreate on each render —
    // which would destroy the instance mid-playback.
    const callbacksRef = useRef({ onPlay, onPause, onFinish, onReady });
    useEffect(() => {
      callbacksRef.current = { onPlay, onPause, onFinish, onReady };
    });

    useEffect(() => {
      const node = containerRef.current;
      if (!node) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        },
        { rootMargin: "200px" }
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!shouldLoad || !containerRef.current) return;

      const ws = WaveSurfer.create({
        container: containerRef.current,
        height: 40,
        waveColor: "#4b5563",
        progressColor: "#3b82f6",
        cursorColor: "#60a5fa",
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        url: audioUrl,
      });
      wsRef.current = ws;

      ws.on("ready", () => {
        void routeMediaElementToSink(ws.getMediaElement());
        callbacksRef.current.onReady?.(ws.getDuration());
      });
      ws.on("play", () => callbacksRef.current.onPlay?.());
      ws.on("pause", () => callbacksRef.current.onPause?.());
      ws.on("finish", () => callbacksRef.current.onFinish?.());

      const unsubscribeSink = subscribeToAudioSinkChanges(() => {
        void routeMediaElementToSink(ws.getMediaElement());
      });

      return () => {
        unsubscribeSink();
        try {
          ws.destroy();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      };
    }, [shouldLoad, audioUrl]);

    useImperativeHandle(ref, () => ({
      play: () => {
        wsRef.current?.play();
      },
      pause: () => {
        wsRef.current?.pause();
      },
      isPlaying: () => wsRef.current?.isPlaying() ?? false,
    }));

    return (
      <div
        ref={containerRef}
        className="w-full min-h-[40px] bg-gray-900/40 rounded"
      />
    );
  }
);

RecordingWaveform.displayName = "RecordingWaveform";
export default RecordingWaveform;
