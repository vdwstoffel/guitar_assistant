"use client";

import { useRef, useCallback, useEffect } from "react";
import { Track, JamTrack } from "@/types";

const MIN_SESSION_SECONDS = 10;

interface SessionState {
  playStartedAt: number | null; // Date.now() when play started
  accumulatedSeconds: number;
  trackId: string | null;
  jamTrackId: string | null;
  trackTitle: string;
}

function isJamTrack(track: Track | JamTrack): track is JamTrack {
  return "pdfs" in track;
}

async function saveSession(
  state: SessionState,
  playbackSpeed: number,
  completed: boolean
) {
  const totalSeconds =
    state.accumulatedSeconds +
    (state.playStartedAt ? (Date.now() - state.playStartedAt) / 1000 : 0);

  if (totalSeconds < MIN_SESSION_SECONDS) return;

  try {
    await fetch("/api/metrics/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackId: state.trackId,
        jamTrackId: state.jamTrackId,
        durationSeconds: Math.round(totalSeconds),
        playbackSpeed,
        completedSession: completed,
      }),
    });
  } catch {
    // Don't block playback on tracking failures
  }
}

export function usePracticeSessionTracker(
  track: Track | JamTrack | null,
  playbackSpeed: number
) {
  const stateRef = useRef<SessionState>({
    playStartedAt: null,
    accumulatedSeconds: 0,
    trackId: null,
    jamTrackId: null,
    trackTitle: "",
  });
  const speedRef = useRef(playbackSpeed);
  speedRef.current = playbackSpeed;

  // Reset session when track changes, saving any in-progress session
  useEffect(() => {
    const prev = stateRef.current;
    if (prev.playStartedAt || prev.accumulatedSeconds > 0) {
      saveSession(prev, speedRef.current, false);
    }

    stateRef.current = {
      playStartedAt: null,
      accumulatedSeconds: 0,
      trackId: track && !isJamTrack(track) ? track.id : null,
      jamTrackId: track && isJamTrack(track) ? track.id : null,
      trackTitle: track?.title ?? "",
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
  }, []);

  const onFinish = useCallback(() => {
    const state = stateRef.current;
    saveSession(state, speedRef.current, true);
    // Reset for next play-through
    state.playStartedAt = null;
    state.accumulatedSeconds = 0;
  }, []);

  // Save session on unmount
  useEffect(() => {
    return () => {
      const state = stateRef.current;
      if (state.playStartedAt || state.accumulatedSeconds > 0) {
        saveSession(state, speedRef.current, false);
      }
    };
  }, []);

  return { onPlay, onPause, onFinish };
}
