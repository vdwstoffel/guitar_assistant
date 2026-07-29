'use client';

import { useEffect, useRef, useState } from 'react';
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from '@/lib/audioSink';

interface BackingTrackAudioPlayerProps {
  audioPath: string;
  title?: string;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Build a URL-safe /api/audio path (encode each segment). */
function audioUrl(audioPath: string): string {
  return `/api/audio/${audioPath.split('/').map(encodeURIComponent).join('/')}`;
}

export default function BackingTrackAudioPlayer({ audioPath, title }: BackingTrackAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [looping, setLooping] = useState(false);
  const [volume, setVolume] = useState(1);

  // Route audio to the app-selected output device, and re-route when it changes.
  useEffect(() => {
    const el = audioRef.current;
    void routeMediaElementToSink(el);
    const unsub = subscribeToAudioSinkChanges(() => void routeMediaElementToSink(el));
    return unsub;
  }, [audioPath]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void routeMediaElementToSink(el);
      void el.play();
    } else {
      el.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const t = Number(e.target.value);
    el.currentTime = t;
    setCurrent(t);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <div className="w-full rounded-lg bg-neutral-900/70 border border-neutral-700 p-4 flex flex-col gap-3">
      <audio
        ref={audioRef}
        src={audioUrl(audioPath)}
        loop={looping}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          void routeMediaElementToSink(e.currentTarget);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="metadata"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center shrink-0"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>

        <span className="text-xs text-amber-200/70 font-mono w-12 text-right">{formatTime(current)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={handleSeek}
          className="flex-1 accent-amber-500"
          aria-label="Seek"
        />
        <span className="text-xs text-amber-200/70 font-mono w-12">{formatTime(duration)}</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setLooping((l) => !l)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            looping ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
          aria-pressed={looping}
        >
          🔁 Loop
        </button>

        <div className="flex items-center gap-2 flex-1 max-w-[160px]">
          <span className="text-xs text-neutral-400">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolume}
            className="flex-1 accent-amber-500"
            aria-label="Volume"
          />
        </div>

        {title && <span className="ml-auto text-xs text-neutral-500 truncate">{title}</span>}
      </div>
    </div>
  );
}
