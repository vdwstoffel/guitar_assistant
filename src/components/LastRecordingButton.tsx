"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Recording } from "@/types";
import { formatDuration } from "@/lib/recordings/format";
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";

interface Props {
  recording: Recording | null;
  /** Bumped by the parent to force playback to stop (panel closed, recording started). */
  stopSignal?: number;
}

/**
 * One-line play/pause control for the most recent recording, shown inside the
 * mini recorder panel so a take can be reviewed without opening /recordings.
 *
 * Mount this with `key` set to the recording id so a newer take gets a fresh
 * element and a reset play state.
 */
export default function LastRecordingButton({ recording, stopSignal = 0 }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const audioUrl = recording
    ? `/api/audio/${recording.filePath.split("/").map(encodeURIComponent).join("/")}`
    : null;

  // Keep the element pointed at the user's chosen output device. The cleanup
  // pauses on unmount — a detached <audio> keeps playing otherwise, and the
  // parent remounts this (via key) whenever a newer take arrives.
  useEffect(() => {
    const el = audioRef.current;
    void routeMediaElementToSink(el);
    const unsubscribe = subscribeToAudioSinkChanges(() => {
      void routeMediaElementToSink(audioRef.current);
    });
    return () => {
      unsubscribe();
      el?.pause();
    };
  }, [audioUrl]);

  useEffect(() => {
    if (stopSignal === 0) return;
    const el = audioRef.current;
    if (el && !el.paused) el.pause();
  }, [stopSignal]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch((err) => console.warn("Recording playback failed", err));
    } else {
      el.pause();
    }
  }, []);

  if (!recording || !audioUrl) return null;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <button
        onClick={toggle}
        className="w-9 h-9 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white"
        title={playing ? "Pause last recording" : "Play last recording"}
        aria-label={playing ? "Pause last recording" : "Play last recording"}
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      <div className="min-w-0 leading-tight">
        <div className="text-sm text-gray-200 truncate max-w-[14rem]" title={recording.title}>
          {recording.title}
        </div>
        <div className="text-xs text-gray-500 tabular-nums">
          Last take · {formatDuration(recording.duration)}
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
