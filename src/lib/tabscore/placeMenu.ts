/** A box on screen, in CSS pixels from the viewport's top left. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Where the note menu goes: its top-left corner, the most it may be tall, and which side of the bar it is on. */
export interface MenuPlacement {
  left: number;
  top: number;
  maxHeight: number;
  side: "below" | "above";
}

/** The space between the bar and the menu. */
export const MENU_GAP = 4;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

/**
 * Place the note menu at its bar. `anchor` is the bar, from the anchor beat's
 * left edge to the bar's right edge and from the bar's top to its bottom;
 * `menu` is the menu's own size; `bounds` is the box the menu may use. The
 * note menu gives it the score panel's left and width and the window's height:
 * the menu floats above the page, so where the panel is short it may use the
 * window's height, but sideways it stays inside the panel.
 *
 * Below the bar when it fits there, else above; when neither side has room,
 * the larger side, with `maxHeight` the room there so the menu scrolls inside
 * itself. Its left edge is the anchor beat's, moved left as far as it must to
 * end inside the bounds, but never past their left edge; its top stays inside
 * them too, so a bar partly scrolled out still gets a menu on screen. Room is
 * only ever counted inside the bounds: zero-size bounds give zero room. When
 * neither side has any room at all (a bar that fills the bounds), `maxHeight`
 * is 0 and the menu sits on the bounds' bottom edge — unreachable in practice,
 * since the note menu gives them the window's height.
 */
export function placeMenu({ anchor, menu, bounds }: { anchor: Rect; menu: Size; bounds: Rect }): MenuPlacement {
  const boundsBottom = bounds.top + Math.max(bounds.height, 0);
  const boundsRight = bounds.left + Math.max(bounds.width, 0);
  const anchorBottom = anchor.top + anchor.height;
  const below = Math.max(boundsBottom - Math.max(anchorBottom + MENU_GAP, bounds.top), 0);
  const above = Math.max(Math.min(anchor.top - MENU_GAP, boundsBottom) - bounds.top, 0);
  const side = menu.height <= below ? "below" : menu.height <= above ? "above" : below >= above ? "below" : "above";
  const room = side === "below" ? below : above;
  const height = Math.min(menu.height, room);
  const top = side === "below" ? anchorBottom + MENU_GAP : anchor.top - MENU_GAP - height;
  return {
    left: clamp(anchor.left, bounds.left, boundsRight - menu.width),
    top: clamp(top, bounds.top, boundsBottom - height),
    maxHeight: room,
    side,
  };
}

/**
 * Whether any of the bar is inside the bounds. For this the bounds are the
 * part of the score panel that shows music (not the larger box `placeMenu` may
 * be given). When none of the bar is — scrolled out of the panel, or the whole
 * panel off the window, which measures as bounds with no area — the menu is
 * hidden until it comes back.
 */
export function anchorInView(anchor: Rect, bounds: Rect): boolean {
  return (
    // Bounds with no area show nothing, however the bar's edges lie against them.
    bounds.width > 0 &&
    bounds.height > 0 &&
    anchor.top < bounds.top + bounds.height &&
    anchor.top + anchor.height > bounds.top &&
    anchor.left < bounds.left + bounds.width &&
    // `barClientRect` floors a bar's width at 0, and a zero-width bar inside the panel is still in view.
    anchor.left + Math.max(anchor.width, 1) > bounds.left
  );
}
