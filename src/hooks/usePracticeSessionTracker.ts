"use client";

import { useRef, useCallback, useEffect } from "react";
import { playedRefForItem, type PlayedRef, type TrackableItem } from "@/lib/metrics/playedRef";

const MIN_PLAY_SECONDS = 4;

interface TrackerState {
  playStartedAt: number | null; // Date.now() when play started, else null
  accumulatedSeconds: number;
  marked: boolean; // whether a play has already been recorded for the current item
  ref: PlayedRef | null;
}

// Records lastPlayedAt once per item selection, after >= 4s of accumulated playback.
async function markPlayed(state: TrackerState) {
  const total =
    state.accumulatedSeconds +
    (state.playStartedAt ? (Date.now() - state.playStartedAt) / 1000 : 0);

  if (state.marked || !state.ref || total < MIN_PLAY_SECONDS) return;
  state.marked = true;

  try {
    await fetch("/api/metrics/played", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.ref),
    });
  } catch {
    // Don't block playback on tracking failures
  }
}

export function usePracticeSessionTracker(track: TrackableItem | null) {
  const stateRef = useRef<TrackerState>({
    playStartedAt: null,
    accumulatedSeconds: 0,
    marked: false,
    ref: null,
  });

  // On item change: flush any pending play for the previous item, then reset.
  useEffect(() => {
    markPlayed(stateRef.current);
    stateRef.current = {
      playStartedAt: null,
      accumulatedSeconds: 0,
      marked: false,
      ref: track ? playedRefForItem(track) : null,
    };
  }, [track?.id]);

  const onPlay = useCallback(() => {
    stateRef.current.playStartedAt = Date.now();
  }, []);

  const onPause = useCallback(() => {
    const state = stateRef.current;
    if (state.playStartedAt) {
      state.accumulatedSeconds += (Date.now() - state.playStartedAt) / 1000;
      state.playStartedAt = null;
    }
    markPlayed(state);
  }, []);

  const onFinish = useCallback(() => {
    markPlayed(stateRef.current);
  }, []);

  // Flush on section change (dispatched as 'practiceSessionFlush' by the page shell).
  useEffect(() => {
    const handleFlush = () => markPlayed(stateRef.current);
    window.addEventListener("practiceSessionFlush", handleFlush);
    return () => window.removeEventListener("practiceSessionFlush", handleFlush);
  }, []);

  // Flush on unmount.
  useEffect(() => {
    return () => {
      markPlayed(stateRef.current);
    };
  }, []);

  return { onPlay, onPause, onFinish };
}
