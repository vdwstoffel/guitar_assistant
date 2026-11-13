/**
 * Never lose a take.
 *
 * From Record until Save riff a take exists only in memory: while it is being
 * recorded, and while it waits in the capture panel. Leaving the Write view
 * (or the page) throws it away, so while there is one every way out asks
 * first; and in the capture panel Escape asks before discarding it.
 */

export const DISCARD_TAKE_QUESTION = "Discard this take?";
export const LEAVE_TAKE_QUESTION = "You have an unsaved take. Leave and lose it?";

const FIELD_TAGS = ["INPUT", "SELECT", "TEXTAREA"];

export interface EscapeLike {
  key: string;
  repeat?: boolean;
  isComposing?: boolean;
  /** The tag name of the element the key went to. */
  targetTag?: string | null;
}

/**
 * What a key press does in the capture panel. Escape in a box belongs to the
 * box ("field": it drops what is typed there, if anything) and never closes
 * the panel; Escape anywhere else asks whether to discard the take. Held down,
 * only the first press counts; while saving it does nothing.
 */
export function captureEscapeAction(e: EscapeLike, saving: boolean): "field" | "ask-discard" | null {
  if (e.key !== "Escape" || e.repeat || e.isComposing || saving) return null;
  if (e.targetTag && FIELD_TAGS.includes(e.targetTag.toUpperCase())) return "field";
  return "ask-discard";
}

export interface LinkClick {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

export interface LinkTarget {
  href: string;
  /** The link's `target` attribute ("" when it has none). */
  target: string;
  download: boolean;
}

/**
 * Whether a click on a link moves this tab to another page of the app. A
 * click that opens another tab or window, or a download, loses nothing; a
 * link to another site unloads the page, which `beforeunload` already asks
 * about.
 */
export function linkLeavesView(click: LinkClick, link: LinkTarget, here: string): boolean {
  if (click.defaultPrevented || click.button !== 0 || click.ctrlKey || click.metaKey || click.shiftKey || click.altKey) return false;
  if (link.download || (link.target !== "" && link.target !== "_self")) return false;
  let to: URL;
  let from: URL;
  try {
    to = new URL(link.href, here);
    from = new URL(here);
  } catch {
    return false;
  }
  return to.origin === from.origin && (to.pathname !== from.pathname || to.search !== from.search);
}

// How many takes are unsaved right now (one Write view has at most one; a
// count rather than a flag so a remount's cleanup cannot clear a newer guard).
let unsaved = 0;

export function hasUnsavedTake(): boolean {
  return unsaved > 0;
}

/** Before a way out of the Write view: true when there is no take to lose, or the player chooses to lose it. */
export function mayLeaveTake(ask: (question: string) => boolean = (q) => window.confirm(q)): boolean {
  return !hasUnsavedTake() || ask(LEAVE_TAKE_QUESTION);
}

/**
 * Mark a take as unsaved until the returned function is called. Meanwhile a
 * reload or leaving the site gets the browser's own "leave site?" prompt, and
 * a click on any link to another page of the app (the Songs links, the top
 * navigation) asks `LEAVE_TAKE_QUESTION` first; buttons that leave the view
 * call `mayLeaveTake` themselves.
 */
export function guardUnsavedTake(): () => void {
  unsaved += 1;
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = ""; // older browsers show the prompt only with this set
  };
  // Capture phase, on the document: it runs before React's handlers, so a
  // "stay" keeps a Next.js Link (and its onClick) from ever seeing the click.
  const onClick = (e: MouseEvent) => {
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!(a instanceof HTMLAnchorElement)) return;
    const link = { href: a.href, target: a.getAttribute("target") ?? "", download: a.hasAttribute("download") };
    if (!linkLeavesView(e, link, window.location.href) || mayLeaveTake()) return;
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("click", onClick, true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    unsaved -= 1;
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("click", onClick, true);
  };
}
