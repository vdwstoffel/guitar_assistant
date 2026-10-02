/**
 * Who owns the window-level keyboard shortcuts.
 *
 * BottomPlayer binds Space, M, P and the arrow keys on `window`, so they work
 * wherever you are on the page. That is right until something opens that is
 * ITSELF about playing something — the tab editor — at which point Space
 * belongs to the thing you are looking at, not to the audio player behind it.
 *
 * The editor cannot settle this by stopping propagation alone: its own
 * handler is bound to its container, so it only sees the keystroke when the
 * canvas has focus. Press Space right after opening the editor, or after
 * clicking any toolbar button, and the event goes straight to the window —
 * and the track started playing instead of the tab.
 *
 * So ownership is explicit. A claimant holds it while mounted, and the
 * player's global handler stands down for as long as anything does. Counted
 * rather than a boolean: React may mount the next owner before unmounting
 * the last (Strict Mode double-invokes effects, and a dialog can hand over
 * to another), and a boolean would be cleared by the departing one.
 */
let claims = 0;

/** Take ownership. Call the returned function to give it back. */
export function claimGlobalShortcuts(): () => void {
  claims++;
  let released = false;
  return () => {
    // Guarded: an effect cleanup can run more than once in development, and
    // double-releasing would hand the keyboard back while an owner is still
    // on screen.
    if (released) return;
    released = true;
    claims = Math.max(0, claims - 1);
  };
}

/** Whether something other than the page itself owns the shortcuts now. */
export function globalShortcutsClaimed(): boolean {
  return claims > 0;
}
