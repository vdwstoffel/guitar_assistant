"use client";

import { useState, useEffect, memo } from "react";

const InProgressIndicator = memo(function InProgressIndicator({
  trackId,
  completed,
  onClear
}: {
  trackId: string;
  completed: boolean;
  onClear?: () => void;
}) {
  const [speed, setSpeed] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`playbackSpeed_${trackId}`);
    setSpeed(stored ? parseInt(stored) : null);

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
    localStorage.removeItem(`playbackSpeed_${trackId}`);
    setSpeed(null);
    onClear?.();
  };

  if (completed || !speed) return null;

  return (
    <button
      onClick={handleClick}
      className="relative flex items-center justify-center min-w-[2.5rem] h-5 px-1.5 rounded-full border border-amber-500/50 bg-amber-900/30 flex-shrink-0 transition-colors hover:bg-amber-500/20"
      title={`Practicing at ${speed}% - Click to clear practice progress`}
    >
      <span className="text-[10px] font-medium text-amber-400 whitespace-nowrap">
        {speed}%
      </span>
    </button>
  );
});

export default InProgressIndicator;
