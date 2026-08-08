"use client";

import { useRef } from "react";
import { formatDurationLong } from "@/lib/formatting";

interface VideoMarker { id: string; name: string; timestamp: number; videoId: string; }

interface MarkerTimelineProps {
  duration: number | null;
  currentTime: number;
  markers: VideoMarker[];
  loopA: number | null;
  loopB: number | null;
  onSeek: (t: number) => void;
  onJumpToMarker: (m: VideoMarker) => void;
}

// The player's seek bar: click/drag to scrub, marker ticks to jump, an amber
// A/B loop band, a played-fill, and a draggable knob.
export default function MarkerTimeline({
  duration, currentTime, markers, loopA, loopB, onSeek, onJumpToMarker,
}: MarkerTimelineProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const dur = duration && duration > 0 ? duration : 0;
  const pct = (t: number) => (dur ? `${Math.min(100, Math.max(0, (t / dur) * 100))}%` : "0%");
  const loopActive = loopA !== null && loopB !== null && loopB > loopA;

  const seekFromClientX = (clientX: number) => {
    if (!dur || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    onSeek(Math.min(dur, Math.max(0, ratio * dur)));
  };

  return (
    <div className="relative pt-2">
      {/* Marker ticks — small diamonds sitting above the track */}
      {dur > 0 && markers.map((m) => (
        <button
          key={m.id}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onJumpToMarker(m); }}
          className="absolute top-0 -translate-x-1/2 z-10 group/tick"
          style={{ left: pct(m.timestamp) }}
          title={`${formatDurationLong(m.timestamp)} — ${m.name}`}
        >
          <span className="block w-2 h-2 rotate-45 rounded-[1px] bg-green-400 group-hover/tick:bg-green-200" />
        </button>
      ))}

      {/* Track (click / drag to seek) */}
      <div
        ref={barRef}
        onPointerDown={(e) => { barRef.current?.setPointerCapture(e.pointerId); seekFromClientX(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons & 1) seekFromClientX(e.clientX); }}
        className="relative h-1.5 rounded-full bg-white/25 cursor-pointer"
      >
        {loopActive && (
          <div
            className="absolute inset-y-0 bg-amber-400/60"
            style={{ left: pct(loopA!), width: `calc(${pct(loopB!)} - ${pct(loopA!)})` }}
          />
        )}
        <div className="absolute inset-y-0 left-0 rounded-full bg-green-500" style={{ width: pct(currentTime) }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow pointer-events-none"
          style={{ left: pct(currentTime) }}
        />
      </div>
    </div>
  );
}
