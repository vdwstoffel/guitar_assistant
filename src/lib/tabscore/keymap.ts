import { TECHNIQUE_KEYS, type Technique } from "./commands/technique";

export interface ChordEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
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
  | { kind: "playPause" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "showHelp" };

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
 * lives in TabEditor's `digitBufferRef`, not here — this resolves ONE
 * keydown at a time, always returning a single-digit `setFret`. Touches no
 * DOM: no preventDefault/stopPropagation here either; the caller applies
 * those only when the result is non-null.
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
    if (key === "ArrowLeft") return { kind: "moveBeat", delta: -1 };
    if (key === "ArrowRight") return { kind: "moveBeat", delta: 1 };
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
