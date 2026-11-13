"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SESSION,
  SESSION_STORAGE_KEY,
  parseSessionPrefs,
  serializeSessionPrefs,
  type SessionPrefs,
} from "@/lib/songwriting/sessionPrefs";

/**
 * The writing session's settings, kept in localStorage. The first render (and
 * the server's) always sees the defaults; the saved prefs load in an effect so
 * hydration never mismatches.
 */
export function useSessionPrefs(): [SessionPrefs, (update: Partial<SessionPrefs>) => void] {
  const [prefs, setPrefs] = useState<SessionPrefs>(DEFAULT_SESSION);
  const latest = useRef<SessionPrefs>(DEFAULT_SESSION);

  useEffect(() => {
    try {
      const saved = parseSessionPrefs(localStorage.getItem(SESSION_STORAGE_KEY));
      latest.current = saved;
      // Loading an external store after mount is the point: first render must match the server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefs(saved);
    } catch {
      /* storage unavailable: keep the defaults */
    }
  }, []);

  const update = useCallback((patch: Partial<SessionPrefs>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setPrefs(next);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, serializeSessionPrefs(next));
    } catch {
      /* storage unavailable: the session just won't persist */
    }
  }, []);

  return [prefs, update];
}
