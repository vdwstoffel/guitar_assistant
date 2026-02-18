"use client";

import { useState, useEffect, memo } from "react";

const InProgressIndicator = memo(function InProgressIndicator({
  trackId,
  completed,
  playbackSpeed: initialSpeed,
  isJamTrack = false,
}: {
  trackId: string;
  completed: boolean;
  playbackSpeed?: number | null;
  isJamTrack?: boolean;
}) {
  const [speed, setSpeed] = useState<number | null>(initialSpeed ?? null);

  // Sync with prop changes (e.g., when track data refreshes from DB)
  useEffect(() => {
    setSpeed(initialSpeed ?? null);
  }, [initialSpeed]);

  useEffect(() => {
    const handleSpeedChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ trackId: string; speed: number }>;
      if (customEvent.detail.trackId === trackId) {
        setSpeed(customEvent.detail.speed);
      }
    };

    window.addEventListener('playbackSpeedChange', handleSpeedChange);
    return () => {
      window.removeEventListener('playbackSpeedChange', handleSpeedChange);
    };
  }, [trackId]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSpeed(null);
    // Clear playback speed in DB
    const url = isJamTrack
      ? `/api/jamtracks/${trackId}`
      : `/api/tracks/${trackId}/tempo`;
    fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playbackSpeed: null }),
    }).catch(err => console.error("Failed to clear playback speed:", err));
    // Notify BottomPlayer if it's playing this track
    window.dispatchEvent(new CustomEvent('playbackSpeedChange', {
      detail: { trackId, speed: 100 }
    }));
  };

  if (completed || !speed || speed === 100) return null;

  return (
    <button
      onClick={handleClick}
      className="relative flex items-center justify-center min-w-10 h-5 px-1.5 rounded-full border border-amber-500/50 bg-amber-900/30 shrink-0 transition-colors hover:bg-amber-500/20"
      title={`Practicing at ${speed}% - Click to clear practice progress`}
    >
      <span className="text-[10px] font-medium text-amber-400 whitespace-nowrap">
        {speed}%
      </span>
    </button>
  );
});

export default InProgressIndicator;
