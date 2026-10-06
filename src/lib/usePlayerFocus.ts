"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  focusedPlayer,
  isPlayerRegistered,
  registerPlayer,
  subscribeToPlayerFocus,
  type PlayerId,
} from "./playerFocus";

/**
 * React's view of [playerFocus]. Kept out of that module so its store and the
 * `keyboardOwner` rule stay testable without React.
 */

const serverSnapshot = () => null;

/** Which player has the keyboard, re-rendering when it moves. */
export function useFocusedPlayer(): PlayerId | null {
  return useSyncExternalStore(subscribeToPlayerFocus, focusedPlayer, serverSnapshot);
}

/** Whether a tab player is on screen, re-rendering when that changes. */
export function useTabPlayerPresent(): boolean {
  return useSyncExternalStore(
    subscribeToPlayerFocus,
    () => isPlayerRegistered("tab"),
    () => false,
  );
}

/** Announce a player for as long as the component is mounted. */
export function useRegisterPlayer(id: PlayerId, active = true): void {
  useEffect(() => {
    if (!active) return;
    return registerPlayer(id);
  }, [id, active]);
}
