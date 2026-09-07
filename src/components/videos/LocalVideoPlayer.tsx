"use client";

import { useEffect, useRef, useState } from "react";
import { Video } from "@/types";
import { clampPlaybackRate, loopSeekTarget, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE } from "@/lib/video/playback";
import { DEFAULT_VOLUME, storedToElementVolume, elementToStoredVolume } from "@/lib/video/volume";
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
import { formatDurationLong } from "@/lib/formatting";
import MarkerTimeline from "./MarkerTimeline";

const PRESETS = [0.5, 0.75, 1] as const;
const SHORTCUTS_HINT =
  "Space play/pause · ←/→ seek ±5s · M add marker · A/B set loop start/end · +/− volume · 1–9,0 jump to marker";

interface VideoMarker { id: string; name: string; timestamp: number; videoId: string; }

interface LocalVideoPlayerProps {
  video: Video;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  markers: VideoMarker[];
  loopA: number | null;
  loopB: number | null;
  onClearLoop: () => void;
  onSetLoopA: (t: number) => void;
  onSetLoopB: (t: number) => void;
  onAddMarker: () => void;
  onTimeUpdate: (t: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onError?: () => void;
  onVolumeChange?: (volume: number) => void;
}

export default function LocalVideoPlayer({
  video, videoRef, markers, loopA, loopB, onClearLoop, onSetLoopA, onSetLoopB,
  onAddMarker, onTimeUpdate, onPlay, onPause, onEnded, onError, onVolumeChange,
}: LocalVideoPlayerProps) {
  const [speed, setSpeed] = useState(1);
  const [speedText, setSpeedText] = useState("1");
  const [curTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(video.duration ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const saveVolumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const src = `/api/video/${video.localPath!.split("/").map(encodeURIComponent).join("/")}`;

  const applySpeed = () => {
    const parsed = parseFloat(speedText);
    const clamped = clampPlaybackRate(Number.isNaN(parsed) ? 1 : parsed);
    setSpeed(clamped);
    setSpeedText(String(clamped));
  };

  // Re-route audio to the selected output device on mount and on change.
  useEffect(() => {
    void routeMediaElementToSink(videoRef.current);
    return subscribeToAudioSinkChanges(() => { void routeMediaElementToSink(videoRef.current); });
  }, [videoRef]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, videoRef]);

  // Track fullscreen so the wrapper can switch between hugging the video and filling the screen.
  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    const v = storedToElementVolume(video.volume);
    el.volume = v;
    el.playbackRate = speed;
    setVolumeState(v);
    setMuted(el.muted);
    setCurTime(el.currentTime);
    setDuration(Number.isFinite(el.duration) ? el.duration : (video.duration ?? null));
    void routeMediaElementToSink(el);
  };

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    const target = loopSeekTarget(el.currentTime, loopA, loopB);
    if (target !== null) el.currentTime = target;
    setCurTime(el.currentTime);
    onTimeUpdate(el.currentTime);
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  const seekTo = (t: number) => { if (videoRef.current) videoRef.current.currentTime = t; };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  // Debounced because dragging the slider fires volumechange continuously.
  // The equality check skips the event handleLoadedMetadata triggers when it
  // applies the stored value, so loading a video never writes it straight back.
  const persistVolume = (elementVolume: number) => {
    const stored = elementToStoredVolume(elementVolume);
    if (stored === (video.volume ?? DEFAULT_VOLUME)) return;

    onVolumeChange?.(stored);

    const videoId = video.id;
    if (saveVolumeTimeoutRef.current) clearTimeout(saveVolumeTimeoutRef.current);
    saveVolumeTimeoutRef.current = setTimeout(() => {
      fetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: stored }),
      }).catch((err) => console.error("Failed to save video volume:", err));
    }, 500);
  };

  const handleVolumeInput = (v: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = v;
    if (v > 0 && el.muted) { el.muted = false; setMuted(false); }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapperRef.current?.requestFullscreen().catch(() => {});
  };

  const loopActive = loopA !== null && loopB !== null && loopB > loopA;
  const showMuted = muted || volume === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          ref={wrapperRef}
          className={`relative bg-black rounded-lg ${
            isFs ? "flex w-screen h-screen items-center justify-center" : "h-full inline-flex items-center"
          }`}
        >
          <video
            key={video.id}
            ref={videoRef}
            className="h-full w-auto max-w-full rounded-lg"
            src={src}
            onClick={togglePlay}
            onPlay={() => { setIsPlaying(true); onPlay(); }}
            onPause={() => { setIsPlaying(false); onPause(); }}
            onEnded={() => { setIsPlaying(false); onEnded(); }}
            onLoadedMetadata={handleLoadedMetadata}
            onDurationChange={() => {
              const el = videoRef.current;
              if (el && Number.isFinite(el.duration)) setDuration(el.duration);
            }}
            onVolumeChange={() => {
              const el = videoRef.current;
              if (!el) return;
              setVolumeState(el.volume);
              setMuted(el.muted);
              persistVolume(el.volume);
            }}
            onTimeUpdate={handleTimeUpdate}
            onError={() => onError?.()}
          />

          {/* Overlay controls */}
          <div className="absolute inset-x-0 bottom-0 px-3 pb-2 pt-8 bg-linear-to-t from-black/80 to-transparent rounded-b-lg">
            <MarkerTimeline
              duration={duration}
              currentTime={curTime}
              markers={markers}
              loopA={loopA}
              loopB={loopB}
              onSeek={seekTo}
              onJumpToMarker={(m) => seekTo(m.timestamp)}
            />
            <div className="mt-2 flex items-center gap-3 text-white text-xs">
              <button onClick={togglePlay} title={isPlaying ? "Pause (Space)" : "Play (Space)"} className="hover:text-green-400">
                {isPlaying ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5h3v14H8zM13 5h3v14h-3z" /></svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              <span className="font-mono tabular-nums">
                {formatDurationLong(curTime)} / {duration != null ? formatDurationLong(duration) : "--:--"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={toggleMute} title={showMuted ? "Unmute" : "Mute"} className="hover:text-green-400">
                  {showMuted ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3l2.5-2.5-1-1L15.5 11 14 9.5l-1 1L14.5 12 13 13.5l1 1L15.5 13 17 14.5l1-1z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm11 .17v5.66A4 4 0 0016 12a4 4 0 00-2-3.83z" /></svg>
                  )}
                </button>
                <input
                  type="range" min={0} max={1} step={0.05} value={showMuted ? 0 : volume}
                  onChange={(e) => handleVolumeInput(parseFloat(e.target.value))}
                  className="w-20 accent-green-500 cursor-pointer" title="Volume (+/−)"
                />
                <button onClick={toggleFullscreen} title="Fullscreen" className="hover:text-green-400">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Practice controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">Speed</span>
          <input
            type="number"
            min={MIN_PLAYBACK_RATE}
            max={MAX_PLAYBACK_RATE}
            step={0.05}
            value={speedText}
            onChange={(e) => setSpeedText(e.target.value)}
            onBlur={applySpeed}
            onKeyDown={(e) => {
              if (e.key === "Enter") { applySpeed(); (e.target as HTMLInputElement).blur(); }
            }}
            title={`Playback speed (${MIN_PLAYBACK_RATE}×–${MAX_PLAYBACK_RATE}×)`}
            className="w-14 px-2 py-0.5 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-green-500"
          />
          <span className="text-gray-400 mr-1">×</span>
          {PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => { setSpeed(clampPlaybackRate(s)); setSpeedText(String(s)); }}
              className={`px-1.5 py-0.5 rounded font-medium ${
                speed === s ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <span className="w-px h-4 bg-gray-700" />

        <button
          onClick={onAddMarker}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-600 hover:bg-green-700 text-white font-medium"
          title="Add marker at current time (M)"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Marker
        </button>
        <button
          onClick={() => onSetLoopA(videoRef.current?.currentTime ?? 0)}
          className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
          title="Set loop start to current time (A)"
        >
          Set A
        </button>
        <button
          onClick={() => onSetLoopB(videoRef.current?.currentTime ?? 0)}
          className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
          title="Set loop end to current time (B)"
        >
          Set B
        </button>
        {loopActive && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600 text-white font-medium">
            ↻ {formatDurationLong(loopA!)}–{formatDurationLong(loopB!)}
            <button onClick={onClearLoop} title="Clear A/B loop" className="ml-1 hover:text-amber-200">✕</button>
          </span>
        )}

        <span
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 cursor-help"
          title={SHORTCUTS_HINT}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          shortcuts
        </span>
      </div>
    </div>
  );
}
