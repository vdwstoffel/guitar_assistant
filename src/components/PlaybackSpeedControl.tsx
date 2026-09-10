"use client";

import { useState } from "react";
import {
  MIN_PLAYBACK_SPEED,
  MAX_PLAYBACK_SPEED,
  clampPlaybackSpeed,
} from "@/lib/playbackSpeed";

const PRESETS = [60, 70, 80, 90, 100] as const;

interface PlaybackSpeedControlProps {
  /** Current speed as a whole percentage (10-200). */
  speed: number;
  /** Called with a clamped whole percentage. */
  onChange: (speed: number) => void;
  className?: string;
}

/**
 * The percentage speed control shared by the audio player and both video
 * players, so a track and a video are adjusted the same way. Owns only the
 * text input's draft state; the committed speed lives with the caller.
 */
export default function PlaybackSpeedControl({
  speed,
  onChange,
  className = "",
}: PlaybackSpeedControlProps) {
  const [inputValue, setInputValue] = useState("");

  const commit = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) onChange(clampPlaybackSpeed(parsed));
    setInputValue("");
  };

  return (
    <div className={`flex items-center gap-1 sm:gap-2 ${className}`}>
      {PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => onChange(preset)}
          className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
            speed === preset
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600"
          }`}
        >
          {preset}
        </button>
      ))}
      <button
        onClick={() => onChange(clampPlaybackSpeed(speed - 1))}
        className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded text-sm font-bold"
        title="Decrease speed by 1%"
      >−</button>
      <input
        type="number"
        min={MIN_PLAYBACK_SPEED}
        max={MAX_PLAYBACK_SPEED}
        value={inputValue || speed}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-12 sm:w-16 px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-center text-xs focus:outline-none focus:border-green-500"
      />
      <button
        onClick={() => onChange(clampPlaybackSpeed(speed + 1))}
        className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded text-sm font-bold"
        title="Increase speed by 1%"
      >+</button>
      <span className="text-gray-500 text-xs">%</span>
    </div>
  );
}
