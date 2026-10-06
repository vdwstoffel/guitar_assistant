/**
 * Which of two players side by side the keyboard belongs to.
 *
 * A jam track with a Guitar Pro tab shows both at once: the recording on the
 * left, the score where the PDF would be. Both want Space. Neither is on top
 * of the other, so neither can simply win — the keys belong to whichever one
 * you are working in, which is the one you last clicked into.
 *
 * Distinct from [globalShortcuts], which answers a different question: that
 * one is for a surface opened OVER the page (the tab editor, the lessons tab
 * modal), where "the thing in front wins" is the whole rule. An exclusive
 * claim there still beats anything decided here — see `keyboardOwner`.
 */

export type PlayerId = "audio" | "tab";

/**
 * Counted, like the shortcut claims: React mounts the next owner before
 * unmounting the last (Strict Mode double-invokes effects, and switching
 * songs re-keys the player), and a boolean would be cleared by whichever
 * left first.
 */
const registrations = new Map<PlayerId, number>();
let focused: PlayerId | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Announce that this player is on screen. Call the returned function when it
 * leaves.
 */
export function registerPlayer(id: PlayerId): () => void {
  registrations.set(id, (registrations.get(id) ?? 0) + 1);
  notify();

  let released = false;
  return () => {
    // Guarded: an effect cleanup can run more than once in development, and
    // double-releasing would retire a player still on screen.
    if (released) return;
    released = true;

    const left = (registrations.get(id) ?? 1) - 1;
    if (left > 0) {
      registrations.set(id, left);
    } else {
      registrations.delete(id);
      // Its keys go back to the default rather than to a player that is no
      // longer there — switching the panel back to the PDF, say.
      if (focused === id) focused = null;
    }
    notify();
  };
}

export function isPlayerRegistered(id: PlayerId): boolean {
  return (registrations.get(id) ?? 0) > 0;
}

/** Hand the keyboard to this player — what a click inside it does. */
export function focusPlayer(id: PlayerId): void {
  if (focused === id) return;
  focused = id;
  notify();
}

export function focusedPlayer(): PlayerId | null {
  return focused;
}

/** For the focus marker, which has to re-render when the keyboard moves. */
export function subscribeToPlayerFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only. */
export function resetPlayerFocus(): void {
  registrations.clear();
  focused = null;
  listeners.clear();
}

/**
 * Who a key press belongs to right now.
 *
 * Read live, per keystroke, by both players' handlers — it is three reads and
 * a comparison, and re-registering handlers whenever it changes buys nothing.
 */
export function keyboardOwner(state: {
  /** Something opened over the page has taken the keys outright. */
  exclusiveClaim: boolean;
  focused: PlayerId | null;
  tabRegistered: boolean;
}): PlayerId | "none" {
  if (state.exclusiveClaim) return "none";
  // Without a tab on screen there is nothing to arbitrate, and the audio
  // player keeps the keyboard it has always had — in every other section too.
  if (!state.tabRegistered) return "audio";
  return state.focused ?? "audio";
}
