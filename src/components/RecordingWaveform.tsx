"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import WaveSurfer from "wavesurfer.js";

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

      const handleReady = () => onReady?.(ws.getDuration());
      const handlePlay = () => onPlay?.();
      const handlePause = () => onPause?.();
      const handleFinish = () => onFinish?.();

      ws.on("ready", handleReady);
      ws.on("play", handlePlay);
      ws.on("pause", handlePause);
      ws.on("finish", handleFinish);

      return () => {
        try {
          ws.destroy();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      };
    }, [shouldLoad, audioUrl, onReady, onPlay, onPause, onFinish]);

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
