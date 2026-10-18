"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { menuStep, type MenuGroup, type MenuItem } from "@/lib/tabscore/menuItems";
import { anchorInView, placeMenu, type Rect } from "@/lib/tabscore/placeMenu";

export interface NoteMenuProps {
  /** The menu's id, for the control that opens it (aria-controls). */
  id?: string;
  /** TabEditor's menu state. It shows while it is open and its bar is in the score panel. */
  open: boolean;
  /**
   * Keyboard focus moves to the first enabled item when this is a number above
   * 0 not seen before: a keyboard open, or Enter while a mouse-opened menu
   * shows. Pass a counter that only grows; a number is acted on once — when
   * the menu shows, if its bar was not drawn yet when it opened.
   */
  focusRequest: number;
  groups: MenuGroup[];
  /** Its bar and the score panel, on screen; null while the bar is not drawn. */
  locate: () => { anchor: Rect; bounds: Rect } | null;
  /** It began or stopped showing: open, and its bar in the panel. */
  onShownChange: (shown: boolean) => void;
  onRun: (item: MenuItem) => void;
  /** Escape or Tab in the menu, or a key it leaves to the editor: close it. */
  onClose: () => void;
  /** Hand the keyboard back to the editor: the menu is hiding with focus inside. */
  focusEditor: () => void;
}

export interface NoteMenuHandle {
  /** The score moved under the menu: place it again, on the next frame — or, with a mouse over it, once the mouse leaves. */
  reposition(): void;
  /** Whether a node is inside the menu. */
  contains(node: Node | null): boolean;
}

/**
 * Keys that are only ever half of a chord. Pressed alone they do nothing in the
 * menu: they are neither handled nor stopped, and they do not close it, so the
 * chord's own key still arrives — Shift+Tab closes the menu as Tab does, and
 * Ctrl+C reaches the editor.
 */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock", "Fn", "OS"]);

const ITEM =
  "px-2 py-1 text-xs rounded border focus:outline-none focus:ring-2 focus:ring-blue-500";

/**
 * The note menu: every command for the note at the caret — or, with a
 * selection, for the selection — next to it. A `popover="manual"` element:
 * the top layer puts it above alphaTab's layers, the sticky strip and the
 * docked track dialog, unclipped by the score's scroller, and only TabEditor
 * opens or closes it — this mirrors that state with showPopover() and
 * hidePopover(). It hides while its bar is scrolled out of the panel, and
 * shows again when the bar comes back, without moving focus. Nothing moves it
 * while a mouse that has moved or pressed on it is over it — a notice
 * appearing above the score shifts the bar, and the next click would land on
 * another item: it is placed again once the mouse leaves. A menu that only
 * appeared under a resting pointer is not held: the keyboard is working it.
 * (Touch has no hover to wait out, so it never waits.)
 *
 * It stays inside the score panel sideways but may use the window's height,
 * so it is whole even over a short panel. In a browser without the Popover
 * API it is simply absent.
 *
 * It never takes focus from a mouse press (the root prevents mousedown's
 * default, and stops it before the editor's container clears the selection
 * on it), so with a mouse-opened menu every key still goes to the editor.
 * Opened from the keyboard, focus moves in: unmodified arrows, Home and End
 * rove, Enter or Space runs the item through the browser's own click — once,
 * however long the key is held — and Escape or Tab closes it. A bare modifier
 * does nothing. Any other key (Ctrl+Enter, Alt+Left and Shift+Down among them)
 * closes it and goes on to the editor, its React parent, which handles it as
 * usual — except the opener's own auto-repeat, a held Menu key or Shift+F10,
 * which the menu swallows so it does not close what that key just opened.
 *
 * Never give the root a `display` class: an author `display` beats the
 * browser's `[popover]:not(:popover-open) { display: none }`, and the menu
 * would show while closed.
 */
const NoteMenu = forwardRef<NoteMenuHandle, NoteMenuProps>(function NoteMenu(
  { id, open, focusRequest, groups, locate, onShownChange, onRun, onClose, focusEditor },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // The item Tab lands on (roving tabindex); set when an item takes focus.
  const [active, setActive] = useState(0);
  // Read from place(), which also runs from an animation frame and a handle.
  const openRef = useRef(open);
  const groupsRef = useRef(groups);
  const focusRequestRef = useRef(focusRequest);
  const locateRef = useRef(locate);
  const onShownChangeRef = useRef(onShownChange);
  const focusEditorRef = useRef(focusEditor);
  const shownRef = useRef(false);
  // It was due to move while a mouse was over it: place it when the mouse leaves.
  const pendingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const focusHandledRef = useRef(0);
  // The kind of pointer that last pressed or moved over the menu.
  const lastPointerRef = useRef<"mouse" | "pen" | "touch">("mouse");
  // A mouse (or pen) has moved or pressed on the menu since the menu last
  // showed, or since it last left: a click may be about to land, so place()
  // holds the menu still under it. A menu that appeared under a resting
  // pointer has :hover (Chrome) but no move — the keyboard opened it and is
  // working it, and it must go on following its bar.
  const mouseUsedRef = useRef(false);

  useEffect(() => {
    locateRef.current = locate;
    onShownChangeRef.current = onShownChange;
    focusEditorRef.current = focusEditor;
  });

  // A keyboard open, or Enter while it shows: focus its first enabled item —
  // once the menu shows. Each request is acted on once, so the menu showing
  // again after its bar scrolled back does not move focus.
  const takeFocus = useCallback(() => {
    const request = focusRequestRef.current;
    if (!openRef.current || !shownRef.current || request <= 0 || request === focusHandledRef.current) return;
    focusHandledRef.current = request;
    const first = groupsRef.current.flatMap((group) => group.items).findIndex((item) => item.enabled);
    itemRefs.current[Math.max(first, 0)]?.focus();
  }, []);

  // Show the menu where its bar is, or hide it while the bar is out of view —
  // but leave a menu that shows under a mouse in use on it where it is, until
  // the mouse leaves. `force` is the mouse having left: place it whatever
  // :hover says.
  const place = useCallback((force = false) => {
    const root = rootRef.current;
    if (!root) return;
    // A browser without the Popover API (Chrome before 114, Safari before 17) throws on
    // ':popover-open', and React would then unmount the whole editor. Without the API the
    // menu is simply absent.
    if (typeof root.showPopover !== "function") {
      root.hidden = true;
      return;
    }
    // Defer only while a mouse (or a pen) that has moved or pressed on the menu since it showed is
    // over it. Not after a finger: after a tap :hover is sticky — it stays on the last item tapped —
    // and nothing would ever release the deferral: the menu would neither follow its bar nor hide
    // when the bar leaves. (No media query for this: a hybrid tablet's primary pointer says
    // (hover: none) while a mouse is in use.) Not for a pointer that only rests where the menu
    // appeared, which :hover alone cannot tell apart: Chrome gives the menu :hover with no
    // pointermove, and it would freeze while the keyboard works it. And never when `force`: the
    // pointer leaving is itself the proof the mouse left, while Firefox still reports :hover as
    // that event is dispatched.
    if (
      !force &&
      openRef.current &&
      mouseUsedRef.current &&
      lastPointerRef.current !== "touch" &&
      root.matches(":popover-open") &&
      root.matches(":hover")
    ) {
      pendingRef.current = true;
      return;
    }
    pendingRef.current = false;
    const where = openRef.current ? locateRef.current() : null;
    const visible = where !== null && anchorInView(where.anchor, where.bounds);
    if (!visible) {
      if (root.matches(":popover-open")) {
        if (root.contains(document.activeElement)) focusEditorRef.current();
        root.hidePopover();
        mouseUsedRef.current = false;
      }
    } else {
      if (!root.matches(":popover-open")) {
        root.showPopover();
        mouseUsedRef.current = false;
      }
      // Clearing the cap to measure the menu resets its own scroll: put it back.
      const scrolled = root.scrollTop;
      root.style.maxHeight = "none";
      const size = root.getBoundingClientRect();
      // In the top layer the menu may use the window's height, not only the score panel's: a
      // 373 px menu fits neither above nor below a bar in a panel under ~600 px. Sideways it
      // stays inside the panel; the panel alone decides whether the bar is in view.
      const room = { left: where.bounds.left, width: where.bounds.width, top: 8, height: Math.max(window.innerHeight - 16, 0) };
      const at = placeMenu({ anchor: where.anchor, menu: { width: size.width, height: size.height }, bounds: room });
      root.style.left = `${at.left}px`;
      root.style.top = `${at.top}px`;
      root.style.maxHeight = `${at.maxHeight}px`;
      root.scrollTop = scrolled;
    }
    if (shownRef.current !== visible) {
      shownRef.current = visible;
      onShownChangeRef.current(visible);
      // A keyboard open asked for focus before the menu could show — Enter before the score's
      // first render, with no bar to hang under yet: it takes focus now that it shows.
      if (visible) takeFocus();
    }
  }, [takeFocus]);

  // Opening, closing and new contents (a new size) place it before paint.
  useLayoutEffect(() => {
    openRef.current = open;
    groupsRef.current = groups;
    focusRequestRef.current = focusRequest;
    place();
  }, [open, groups, focusRequest, place]);

  // A keyboard open, or Enter while a menu opened with the mouse shows.
  useEffect(() => {
    takeFocus();
  }, [open, focusRequest, takeFocus]);

  useEffect(
    () => () => {
      // Forget it too: were the effects to run again with the refs kept (Fast Refresh, <Activity>),
      // a stale id would make reposition() a permanent no-op.
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      reposition: () => {
        if (!openRef.current || frameRef.current !== null) return;
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          place();
        });
      },
      contains: (node: Node | null) => node !== null && (rootRef.current?.contains(node) ?? false),
    }),
    [place],
  );

  const sizes = groups.map((group) => group.items.length);
  const starts = sizes.map((_, g) => sizes.slice(0, g).reduce((sum, n) => sum + n, 0));
  const roving = active < sizes.reduce((sum, n) => sum + n, 0) ? active : 0;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = itemRefs.current.findIndex((el) => el !== null && el === document.activeElement);
    // Only an unmodified key moves around the menu: Alt+Left is the browser's Back, Ctrl+Home and
    // Shift+Down are the editor's. Held with a modifier they are "any other key", further down.
    const modified = event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
    const next = modified ? null : menuStep(sizes, index, event.key);
    if (next !== null) {
      event.preventDefault();
      event.stopPropagation();
      itemRefs.current[next]?.focus();
      return;
    }
    // A modified Enter or Space is not an activation: Ctrl+Enter (add bar), Alt+Enter and
    // Ctrl+Space are "any other key" below. Shift+Enter and Shift+Space still run the item.
    if ((event.key === "Enter" || event.key === " ") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // The browser's click on the focused item runs it. Kept from the editor,
      // where Space would play and Enter re-open; a held key runs it once.
      event.stopPropagation();
      if (event.repeat) event.preventDefault();
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    // The opener's own auto-repeat (a held Menu key or Shift+F10) is not "any other key".
    if (event.repeat && (event.key === "ContextMenu" || event.key === "F10")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (MODIFIER_KEYS.has(event.key)) return;
    // Any other key closes the menu and goes on, unstopped, to the editor.
    onClose();
  };

  // Which kind of pointer is on the menu decides whether :hover can be trusted, and a mouse that
  // moves or presses on it is one that may click there next (see place()).
  const notePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    lastPointerRef.current = event.pointerType;
    if (event.pointerType !== "touch") mouseUsedRef.current = true;
  };

  return (
    <div
      ref={rootRef}
      id={id}
      popover="manual"
      role="menu"
      aria-label="Note menu"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={notePointer}
      onPointerMove={notePointer}
      onPointerLeave={() => {
        mouseUsedRef.current = false;
        if (pendingRef.current) place(true);
      }}
      onKeyDown={onKeyDown}
      className="fixed right-auto bottom-auto m-0 w-[26rem] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded border border-gray-500 bg-gray-800 p-1.5 text-gray-200 shadow-xl"
    >
      {groups.map((group, g) => (
        <div key={group.label} role="group" aria-label={group.label} className="mb-1.5 last:mb-0">
          <div aria-hidden className="px-0.5 pb-0.5 text-[10px] uppercase tracking-wide text-gray-500">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-1">
            {group.items.map((item, k) => {
              const i = starts[g] + k;
              const look = !item.enabled
                ? "bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed"
                : item.pressed
                  ? "bg-purple-800 border-purple-600 text-white hover:bg-purple-700"
                  : "bg-gray-600 border-gray-500 text-gray-200 hover:bg-gray-500 hover:text-white";
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role={item.pressed === undefined ? "menuitem" : "menuitemcheckbox"}
                  aria-checked={item.pressed}
                  aria-disabled={item.enabled ? undefined : true}
                  aria-keyshortcuts={item.ariaKeys ?? undefined}
                  title={item.reason ?? (item.keyHint ? `${item.label} (${item.keyHint})` : item.label)}
                  tabIndex={i === roving ? 0 : -1}
                  onFocus={() => setActive(i)}
                  onClick={() => {
                    if (item.enabled) onRun(item);
                  }}
                  className={`${ITEM} ${look}`}
                >
                  {item.label}
                  {item.keyHint && (
                    <span aria-hidden className="ml-1 text-gray-400">
                      {item.keyHint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});

export default NoteMenu;
