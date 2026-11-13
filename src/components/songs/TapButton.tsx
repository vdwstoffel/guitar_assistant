"use client";

import { useEffect, useRef, useState } from "react";
import { createTapTempo } from "@/lib/tapTempo";

/** How long after the last tap the tapped tempo counts; the next tap starts a new count. */
const SETTLE_MS = 2000;

/** Click on every beat while the take plays; once you stop, the tempo you tapped is handed on. */
export default function TapButton({ disabled, onTempo }: { disabled?: boolean; onTempo(bpm: number): void }) {
  const tapper = useRef(createTapTempo());
  const timer = useRef<number | null>(null);
  const onTempoRef = useRef(onTempo);
  const [tapping, setTapping] = useState<{ bpm: number | null; taps: number } | null>(null);

  useEffect(() => {
    onTempoRef.current = onTempo;
  });
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  // Applying the tempo restarts the loop check, so it waits until the tapping stops.
  const tap = () => {
    const bpm = tapper.current.tap();
    setTapping({ bpm, taps: tapper.current.getTapCount() });
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const tapped = tapper.current.getBpm();
      tapper.current.reset();
      setTapping(null);
      if (tapped !== null) onTempoRef.current(tapped);
    }, SETTLE_MS);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={tap}
        title="Click on every beat while the riff plays (Loop check); stop for 2 seconds and the tempo is used"
        className="rounded-lg px-3 py-1.5 text-sm font-semibold border border-purple-500 text-purple-300 hover:bg-purple-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Tap
      </button>
      {tapping && (
        <span role="status" className="text-xs text-purple-300 font-mono">
          {tapping.bpm ?? "…"} BPM · {tapping.taps} {tapping.taps === 1 ? "tap" : "taps"}
        </span>
      )}
    </div>
  );
}
