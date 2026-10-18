// Overflowing is not scrolling: content spilling out of an `overflow: visible`
// box, or clipped by `hidden`, has no scrollbar to press.
const scrolls = (overflow: string) => overflow === "auto" || overflow === "scroll" || overflow === "overlay";

/**
 * Whether a press landed on its target's own scrollbar: the target is a scroll
 * container that overflows on that axis, and the press is past what it shows —
 * right of its client box for the vertical scrollbar, below it for the
 * horizontal one. That scrolls; it is not a press on anything inside. A press
 * on the border of an element that does not scroll is not one, nor is a press
 * on SVG (the score's glyphs).
 *
 * The editor's container (a press on the score panel's scrollbar keeps the
 * selection), the note menu's press closer (it does not close the menu) and
 * the score's right-click (it asks for no menu) all ask here, so they cannot
 * disagree about what a scrollbar press is.
 */
export function onOwnScrollbar(target: EventTarget | null, press: MouseEvent): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const pastRight = press.offsetX >= target.clientWidth && target.scrollHeight > target.clientHeight;
  const pastBottom = press.offsetY >= target.clientHeight && target.scrollWidth > target.clientWidth;
  if (!pastRight && !pastBottom) return false;
  const style = getComputedStyle(target);
  return (pastRight && scrolls(style.overflowY)) || (pastBottom && scrolls(style.overflowX));
}
