import { TECHNIQUE_KEYS, type Technique } from "./commands/technique";

export interface ChordEvent {
  key: string;
  /**
   * The physical key (`event.code`, e.g. `KeyA`). A layout whose letters are
   * not Latin types another letter on it, and the browser still takes Ctrl+that
   * key as Ctrl+A; see `isLetter`. Optional: without it, letters match by `key`.
   */
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /**
   * Whether this is a held key's repeat (`event.repeat`). It never changes
   * what a key resolves to; the editor claims a repeated openMenu and drops
   * it, so a held Enter opens the menu once.
   */
  repeat?: boolean;
}

export type ChordCommand =
  | { kind: "setFret"; digit: number }
  | { kind: "moveBeat"; delta: 1 | -1 }
  | { kind: "moveString"; delta: 1 | -1 }
  | { kind: "clearNote" }
  | { kind: "insertBeat" }
  | { kind: "deleteBeat" }
  | { kind: "addBar" }
  | { kind: "deleteBar" }
  | { kind: "scaleDuration"; direction: "halve" | "double" }
  | { kind: "toggleDotted" }
  | { kind: "toggleTechnique"; technique: Technique }
  | { kind: "toggleTie" }
  | { kind: "toggleTuplet" }
  | { kind: "makeRest" }
  | { kind: "fixBar" }
  | { kind: "extendSelection"; delta: 1 | -1 }
  | { kind: "extendSelectionToBar"; delta: 1 | -1 }
  | { kind: "selectAll" }
  | { kind: "clearSelection" }
  | { kind: "duplicate" }
  | { kind: "playPause" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "showHelp" }
  | { kind: "openMenu" };

/**
 * Pure keydown -> command mapping for the tab editor's canvas region.
 * Extracted from TabEditor.tsx (review round 3, structural recommendation)
 * after this exact table had three prior rounds of correctness fixes
 * validated only by hand-tracing — see keymap.test.ts, whose exhaustive
 * cross-product test is the point of this extraction: it would have caught
 * both Important findings from round 3 (Cmd+[/Cmd+. hijacking browser
 * navigation) before they shipped.
 *
 * Holds no state: a digit's own two-key composition into a two-digit fret
 * lives in runCommand.ts (the buffer is TabEditor's `digitBufferRef`), not
 * here — this resolves ONE keydown at a time, always returning a
 * single-digit `setFret`. Touches no DOM: no preventDefault/stopPropagation
 * here either; the caller applies those only when the result is non-null
 * and `claims` it.
 *
 * Every branch is an EXCLUSIVE match on the full modifier set it cares
 * about, not "at least this modifier" — `event.key` doesn't change under
 * Shift/Ctrl/Cmd/Alt for Delete/Backspace/Insert/Enter/letter keys, so a
 * looser check would still claim a chord bound to something else, or to
 * nothing at all (e.g. Ctrl+Shift+Delete, Cmd+[, Ctrl+P), regardless of
 * what the caller does with a non-null result. This has been the single
 * most repeated defect class across this component's review history —
 * every branch below that excludes a modifier combination has a comment
 * naming the real OS/browser shortcut it would otherwise collide with.
 */
export function matchChord(e: ChordEvent): ChordCommand | null {
  const { key } = e;
  const hasCtrlOrMeta = e.ctrlKey || e.metaKey;
  const hasShift = e.shiftKey;
  const hasAlt = e.altKey;

  // Undo/redo and playback are the only two commands a caller may want to
  // treat as exempt from a "does the document currently parse" guard (see
  // TabEditor.tsx) — that's the caller's concern, not this function's; this
  // function only resolves the keydown to a command shape.
  if (hasCtrlOrMeta && key.toLowerCase() === "z") {
    return hasShift ? { kind: "redo" } : { kind: "undo" };
  }
  // Ctrl/Cmd+A selects the whole tab, as in a text field — by the A key on a
  // layout whose letters are not Latin too (isLetter). Ctrl+Shift+A is
  // Chrome's tab search, so Shift stays out of it.
  if (hasCtrlOrMeta && !hasShift && !hasAlt && isLetter(e, "a")) return { kind: "selectAll" };
  // Ctrl/Cmd+C, X and V are deliberately NOT here: the browser fires the
  // copy, cut and paste events TabEditor handles only when their keydown is
  // left alone, and a command here would be preventDefault()ed. clipboardChord,
  // below, says which keydown is one of them.

  // Escape clears the selection — with no modifier: Shift+Esc opens Chrome's
  // task manager. Whether the editor takes the key at all depends on there
  // being a selection or a shown note menu, which Escape closes (see `claims`).
  if (key === "Escape" && !hasCtrlOrMeta && !hasShift && !hasAlt) return { kind: "clearSelection" };
  // Alt+Space opens the window system menu on Windows; Ctrl+Space toggles
  // the OS input method in some locales; Cmd+Space is macOS Spotlight.
  if (!hasCtrlOrMeta && !hasAlt && (key === " " || key === "Spacebar")) {
    return { kind: "playPause" };
  }

  if (!hasCtrlOrMeta && /^[0-9]$/.test(key)) {
    // bare Ctrl+1-9 switches browser tabs
    return { kind: "setFret", digit: Number(key) };
  }

  if (!hasAlt) {
    // Alt+Left/Right is browser back/forward navigation
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const delta = key === "ArrowLeft" ? -1 : 1;
      // Shift selects: beat by beat, or with Ctrl/Cmd to the bar's edge.
      if (hasShift) return hasCtrlOrMeta ? { kind: "extendSelectionToBar", delta } : { kind: "extendSelection", delta };
      return { kind: "moveBeat", delta };
    }
    if (key === "ArrowUp") return { kind: "moveString", delta: -1 };
    if (key === "ArrowDown") return { kind: "moveString", delta: 1 };
  }

  // Ctrl/Cmd+Shift+Backspace -> deleteBar, Shift+Delete/Backspace (alone,
  // no Ctrl/Cmd) -> deleteBeat, plain Delete/Backspace -> clearNote.
  // Ctrl+Shift+Delete is deliberately unclaimed by any of the three —
  // nothing is bound to it. It used to be deleteBar; that chord opens
  // "clear browsing data" in Chrome/Firefox on Windows/Linux, so deleteBar
  // moved to Backspace instead.
  if (key === "Backspace" && hasCtrlOrMeta && hasShift) return { kind: "deleteBar" };
  if ((key === "Delete" || key === "Backspace") && hasShift && !hasCtrlOrMeta) {
    return { kind: "deleteBeat" };
  }
  if ((key === "Delete" || key === "Backspace") && !hasShift) return { kind: "clearNote" };

  if (key === "Enter" && hasCtrlOrMeta) return { kind: "addBar" };
  // The note menu: plain Enter, the Menu key, or Shift+F10, each with no other
  // modifier. Shift+Enter and Alt+Enter stay unbound, and so does a bare F10,
  // which focuses the browser's menu bar in some browsers.
  if (!hasCtrlOrMeta && !hasAlt) {
    if ((key === "Enter" || key === "ContextMenu") && !hasShift) return { kind: "openMenu" };
    if (key === "F10" && hasShift) return { kind: "openMenu" };
  }

  // Plain Insert only -> insertBeat. Shift+Insert (X11 paste-from-selection)
  // and Ctrl+Insert (the paired classic copy gesture) are deliberately
  // excluded so this editor never swallows either.
  if (key === "Insert" && !hasShift && !hasCtrlOrMeta) return { kind: "insertBeat" };

  // Cmd+[ / Cmd+] is browser Back/Forward on macOS (Chrome, Safari,
  // Firefox); Cmd+. is stop-loading. No known collision for Ctrl+[/Ctrl+]/
  // Ctrl+. specifically, but excluded anyway for the same reason as
  // everything else here: match exactly what's bound, not "close enough."
  // `?` is Shift+`/` on a standard layout, so shift is allowed here for the
  // same reason it is on `+`. This one exists because every other binding in
  // this file is invisible: nothing on screen says what any key does.
  if (!hasCtrlOrMeta && !hasAlt && key === "?") return { kind: "showHelp" };

  if (!hasCtrlOrMeta && !hasAlt) {
    // Duration. `+` lengthens the note (8 -> 4) and `-` shortens it
    // (8 -> 16), which is why they map to "double" and "halve" rather than
    // to the denominator's direction — plus means a bigger note value.
    //
    // Shift is deliberately NOT excluded here, unlike most branches: on a
    // standard layout `+` IS Shift+`=` and `_` IS Shift+`-`, so requiring
    // !hasShift would make `+` literally unmatchable. Accepting the
    // unshifted `=` and `-` too means the shortcut works without reaching
    // for Shift, the way zoom controls conventionally do. The numpad's
    // `NumpadAdd`/`NumpadSubtract` also report `+`/`-`, so they work as well.
    //
    // Ctrl/Cmd +/-/= is browser zoom in every major browser, and that is
    // what !hasCtrlOrMeta above is protecting.
    if (key === "-" || key === "_") return { kind: "scaleDuration", direction: "halve" };
    if (key === "+" || key === "=") return { kind: "scaleDuration", direction: "double" };
    if (key === "[") return { kind: "scaleDuration", direction: "halve" };
    if (key === "]") return { kind: "scaleDuration", direction: "double" };
    if (key === ".") return { kind: "toggleDotted" };
    // Tie. `i` for t-I-e, because every letter with a better claim is taken
    // by a technique and the two obvious glyphs are not available: `-` is
    // already "shorter note", and `_` is its shifted form, which the duration
    // branch above deliberately accepts so `-` works with or without Shift.
    if (key === "i") return { kind: "toggleTie" };
    // Triplet. `u` for tUplet — `3` is a fret digit and every letter with a
    // better claim already belongs to a technique.
    if (key === "u") return { kind: "toggleTuplet" };
    // Rest, as AlphaTex writes one. Shift is allowed (R means nothing else);
    // Ctrl/Cmd+R is reload, which this block's !hasCtrlOrMeta leaves alone.
    if (key === "r" || key === "R") return { kind: "makeRest" };
    // Duplicate, Shift allowed likewise. Ctrl+D would bookmark the page.
    if (key === "d" || key === "D") return { kind: "duplicate" };
  }

  // Shift+B fixes the bar at the caret, as in Songsterr. Tested on shiftKey,
  // not on the key's case, so Caps Lock + b still bends; and ahead of the
  // technique letters, which used to read Shift+B as a bend by accident.
  // With Alt as well it is nothing, never a bend.
  if (!hasCtrlOrMeta && hasShift && key.toLowerCase() === "b") {
    return hasAlt ? null : { kind: "fixBar" };
  }

  // Ctrl/Cmd+letter excluded: several of these letters are common browser
  // chords (p=Print, s=Save, t=New tab, n=New window, h=History, l=focus
  // address bar, g=Find next in some browsers, b=bookmarks bar).
  if (!hasCtrlOrMeta && key.length === 1) {
    const technique = TECHNIQUE_KEYS[key.toLowerCase()];
    if (technique) return { kind: "toggleTechnique", technique };
  }

  return null;
}

/**
 * Whether the keydown is the letter `letter` (lower-case a-z) for a Ctrl/Cmd
 * chord: by the letter it types, or — on a layout whose letters are not Latin
 * (Cyrillic, Greek…) — by the physical key, which is how the browser itself
 * finds Ctrl+A, C, X and V there. A Latin layout's own letter wins: AZERTY has
 * Q where QWERTY has A, so Ctrl on that key is Ctrl+Q; Dvorak types k on
 * QWERTY's V.
 */
function isLetter(e: ChordEvent, letter: string): boolean {
  if (e.key.toLowerCase() === letter) return true;
  return e.code === `Key${letter.toUpperCase()}` && !/^[a-z]$/i.test(e.key);
}

/** What the browser does with a keydown it is left: copy, cut, paste over (Ctrl+V), or paste in front (Ctrl+Shift+V). */
export type ClipboardChord = "copy" | "cut" | "paste" | "pasteInsert";

/**
 * The keydowns the browser turns into a copy, cut or paste event at the
 * focused editor: Ctrl/Cmd+C, X and V (matched as isLetter does), Ctrl/Cmd+
 * Shift+V, and the older Ctrl+Insert (copy) and Shift+Insert (paste). None is
 * a keymap command, so the editor never claims their keydown — the event
 * fires only when it is left alone. Shift+Delete, the browser's other cut,
 * removes beats here (matchChord) and never reaches the browser.
 */
export function clipboardChord(e: ChordEvent): ClipboardChord | null {
  if (e.altKey) return null;
  if (e.key === "Insert") {
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) return "paste";
    if (e.ctrlKey && !e.shiftKey && !e.metaKey) return "copy";
    return null;
  }
  if (!(e.ctrlKey || e.metaKey)) return null;
  if (isLetter(e, "v")) return e.shiftKey ? "pasteInsert" : "paste";
  if (e.shiftKey) return null;
  if (isLetter(e, "c")) return "copy";
  if (isLetter(e, "x")) return "cut";
  return null;
}

/**
 * Whether the editor takes a resolved chord from the page (preventDefault and
 * stopPropagation). Every chord but one: Escape closes the note menu while it
 * shows and otherwise clears a selection, so with neither — or with the
 * shortcuts panel open, which Escape closes — it is left to bubble to
 * whatever else listens for it.
 */
export function claims(
  command: ChordCommand,
  state: { selecting: boolean; helpOpen: boolean; menuShown?: boolean },
): boolean {
  return command.kind !== "clearSelection" || ((state.selecting || state.menuShown === true) && !state.helpOpen);
}

/**
 * Whether a command acts on the selection. Every other one clears it first
 * and then acts at the caret as it always has — typing a fret over a
 * selection does not fill every beat.
 */
export function actsOnSelection(kind: ChordCommand["kind"]): boolean {
  switch (kind) {
    case "extendSelection":
    case "extendSelectionToBar":
    case "selectAll":
    case "clearSelection":
    case "clearNote":
    case "deleteBeat":
    case "duplicate":
    case "openMenu":
      return true;
    case "setFret":
    case "moveBeat":
    case "moveString":
    case "insertBeat":
    case "addBar":
    case "deleteBar":
    case "scaleDuration":
    case "toggleDotted":
    case "toggleTechnique":
    case "toggleTie":
    case "toggleTuplet":
    case "makeRest":
    case "fixBar":
    case "playPause":
    case "undo":
    case "redo":
    case "showHelp":
      return false;
    default: {
      // A compile error here means keymap.ts gained a kind that has not been
      // told whether it acts on the selection.
      const unhandled: never = kind;
      return unhandled;
    }
  }
}

/**
 * Whether running the command closes an open note menu, whatever it did:
 * the commands that change the layout under the menu, or take the user
 * somewhere else. Every other command keeps it open, so edits stack on one
 * note — unless it moved the caret (compared by value) or made or ended a
 * selection, which the editor checks after running it.
 */
export function closesMenu(kind: ChordCommand["kind"]): boolean {
  switch (kind) {
    case "insertBeat":
    case "deleteBeat":
    case "addBar":
    case "deleteBar":
    case "fixBar":
    case "duplicate":
    case "selectAll":
    case "clearSelection":
    case "playPause":
    case "undo":
    case "redo":
    case "showHelp":
      return true;
    case "setFret":
    case "clearNote":
    case "makeRest":
    case "scaleDuration":
    case "toggleDotted":
    case "toggleTuplet":
    case "toggleTechnique":
    case "toggleTie":
    case "moveBeat":
    case "moveString":
    case "extendSelection":
    case "extendSelectionToBar":
    case "openMenu":
      return false;
    default: {
      // A compile error here means keymap.ts gained a kind that has not been
      // told whether it closes the note menu.
      const unhandled: never = kind;
      return unhandled;
    }
  }
}
