"use client";

import { useEffect, useRef, useState } from "react";
import PlaybackSpeedControl from "@/components/PlaybackSpeedControl";
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
import { DEFAULT_PLAYBACK_SPEED, speedToRate } from "@/lib/playbackSpeed";
import { OWNS_SPACE_ATTRIBUTE } from "@/lib/playerFocus";
import { takeKeyAction, type OnePlayerGroup, type OnePlayerMember } from "@/lib/songwriting/onePlayer";
import { takeClock } from "@/lib/songwriting/riffView";

export interface TakePlayerProps {
  src: string;
  /** Where the kept part of the take starts and ends, in seconds (an end of Infinity: the end of the file). */
  trimStart: number;
  trimEnd: number;
  /** Go back to `trimStart` at the end instead of stopping. */
  loop?: boolean;
  /** Players that must not sound with this one: starting the take pauses them, and they pause it. */
  group?: OnePlayerGroup;
  /** How loud, 0–1 (a part's mixer level, say); full by default. */
  volume?: number;
}

/** A riff's take, trimmed: play/pause, slowed down without changing its pitch, on the chosen output device. */
export default function TakePlayer({ src, trimStart, trimEnd, loop = false, group, volume = 1 }: TakePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_PLAYBACK_SPEED);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // Seconds into the kept part, in twentieths so a frame that moves nothing re-renders nothing.
  const [pos, setPos] = useState(0);

  const end = Number.isFinite(trimEnd) && trimEnd > trimStart ? trimEnd : (fileDuration ?? Infinity);
  const length = Number.isFinite(end) ? end - trimStart : null;
  const bounds = useRef({ start: trimStart, end, loop });
  useEffect(() => {
    bounds.current = { start: trimStart, end, loop };
  });

  // The source is set here rather than as a prop so unmounting can let go of
  // it: pause, drop the file and stop buffering.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.src = src;
    return () => {
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [src]);

  const member = useRef<OnePlayerMember | null>(null);
  useEffect(() => {
    if (!group) return;
    const me = group.join(() => audioRef.current?.pause());
    member.current = me;
    return () => {
      me.leave();
      if (member.current === me) member.current = null;
    };
  }, [group]);

  useEffect(() => {
    void routeMediaElementToSink(audioRef.current);
    return subscribeToAudioSinkChanges(() => void routeMediaElementToSink(audioRef.current));
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(1, Math.max(0, volume));
  }, [volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.preservesPitch = true;
    el.defaultPlaybackRate = speedToRate(speed);
    el.playbackRate = speedToRate(speed);
  }, [speed]);

  // `timeupdate` comes four times a second, too coarse to stop on the trim
  // end, so while playing each frame checks the position.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el) {
        const b = bounds.current;
        if (el.currentTime >= b.end) {
          el.currentTime = b.start;
          if (!b.loop) el.pause();
        }
        setPos(Math.round(Math.max(0, el.currentTime - b.start) * 20) / 20);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    if (el.currentTime < trimStart || el.currentTime >= end - 0.01) el.currentTime = trimStart;
    el.play().catch((err: unknown) => {
      // A pause() before playback started rejects play(); that is not a failure.
      if (!(err instanceof DOMException && err.name === "AbortError")) console.warn("Take playback failed", err);
    });
  };

  // Back to the top of the kept part; playing on if it was playing.
  const restart = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = trimStart;
    setPos(0);
  };

  const failed = failedSrc === src;
  return (
    // Space inside these controls plays and pauses the take. The marker keeps
    // a window-level Space shortcut (the tab editor's) from acting on it too;
    // preventing the default stops a focused button from also being pressed.
    <div
      {...{ [OWNS_SPACE_ATTRIBUTE]: "" }}
      onKeyDown={(e) => {
        const action = takeKeyAction(e);
        if (!action) return;
        e.preventDefault();
        if (action === "toggle" && !failed) toggle();
      }}
      onKeyUp={(e) => {
        if (takeKeyAction(e)) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => {
          setPlaying(true);
          member.current?.started();
        }}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setFileDuration(Number.isFinite(d) ? d : null);
          e.currentTarget.currentTime = trimStart;
          setPos(0);
        }}
        onEnded={(e) => {
          // The trim end is past the file's real end: start over (or rewind).
          e.currentTarget.currentTime = trimStart;
          setPos(0);
          if (loop) void e.currentTarget.play().catch(() => {});
        }}
        onError={() => setFailedSrc(src)}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-label={playing ? "Pause take" : "Play take"}
        className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {playing ? "❚❚ Pause" : "▶ Play"}
      </button>
      <button
        type="button"
        onClick={restart}
        disabled={failed}
        aria-label="Back to the start of the take"
        title="Back to the start"
        className="rounded-lg border border-gray-600 bg-gray-700 px-2.5 py-1.5 text-sm text-gray-200 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ⏮
      </button>
      <div className="flex min-w-[8rem] flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-gray-700" aria-hidden>
          <div className="h-full bg-amber-500" style={{ width: length ? `${Math.min(100, (pos / length) * 100)}%` : "0%" }} />
        </div>
        <span className="font-mono text-xs tabular-nums text-gray-400">
          {takeClock(pos)}
          {length !== null && ` / ${takeClock(length)}`}
        </span>
        {loop && <span className="text-xs text-gray-500">looping</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Speed</span>
        <PlaybackSpeedControl speed={speed} onChange={setSpeed} />
      </div>
      {failed && (
        <p role="alert" className="w-full text-sm text-red-400">
          The recording could not be loaded.
        </p>
      )}
    </div>
  );
}
