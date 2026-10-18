import { describe, it, expect } from "vitest";
import {
  actsOnSelection, claims, clipboardChord, closesMenu, matchChord, type ChordEvent, type ChordCommand,
} from "./keymap";
import { TECHNIQUE_KEYS, type Technique } from "./commands/technique";

const BASE: Omit<ChordEvent, "key"> = {
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
};

function ev(key: string, mods: Partial<Omit<ChordEvent, "key">> = {}): ChordEvent {
  return { key, ...BASE, ...mods };
}

describe("matchChord — every binding resolves to its command", () => {
  it("digits 0-9 -> setFret", () => {
    for (let d = 0; d <= 9; d++) {
      expect(matchChord(ev(String(d)))).toEqual({ kind: "setFret", digit: d });
    }
  });

  it("arrows -> moveBeat / moveString", () => {
    expect(matchChord(ev("ArrowLeft"))).toEqual({ kind: "moveBeat", delta: -1 });
    expect(matchChord(ev("ArrowRight"))).toEqual({ kind: "moveBeat", delta: 1 });
    expect(matchChord(ev("ArrowUp"))).toEqual({ kind: "moveString", delta: -1 });
    expect(matchChord(ev("ArrowDown"))).toEqual({ kind: "moveString", delta: 1 });
    expect(matchChord(ev("ArrowRight", { ctrlKey: true }))).toEqual({ kind: "moveBeat", delta: 1 });
  });

  it("Shift+←/→ select beat by beat, Ctrl/Cmd+Shift+←/→ to the bar's edge; Shift+↑/↓ still change string", () => {
    expect(matchChord(ev("ArrowRight", { shiftKey: true }))).toEqual({ kind: "extendSelection", delta: 1 });
    expect(matchChord(ev("ArrowLeft", { shiftKey: true }))).toEqual({ kind: "extendSelection", delta: -1 });
    expect(matchChord(ev("ArrowRight", { ctrlKey: true, shiftKey: true }))).toEqual({ kind: "extendSelectionToBar", delta: 1 });
    expect(matchChord(ev("ArrowLeft", { metaKey: true, shiftKey: true }))).toEqual({ kind: "extendSelectionToBar", delta: -1 });
    expect(matchChord(ev("ArrowUp", { shiftKey: true }))).toEqual({ kind: "moveString", delta: -1 });
    expect(matchChord(ev("ArrowRight", { shiftKey: true, altKey: true }))).toBeNull();
  });

  it("Ctrl/Cmd+A selects everything, Escape clears, d duplicates", () => {
    expect(matchChord(ev("a", { ctrlKey: true }))).toEqual({ kind: "selectAll" });
    expect(matchChord(ev("A", { metaKey: true }))).toEqual({ kind: "selectAll" });
    expect(matchChord(ev("Escape"))).toEqual({ kind: "clearSelection" });
    expect(matchChord(ev("d"))).toEqual({ kind: "duplicate" });
    expect(matchChord(ev("D", { shiftKey: true }))).toEqual({ kind: "duplicate" });
  });

  // A layout whose letters are not Latin types another letter on the A key, and the browser still
  // treats Ctrl+that key as Ctrl+A. A Latin layout's own letter wins: AZERTY has Q where QWERTY has A.
  it("Ctrl/Cmd+A is the physical A key on a layout whose letters are not Latin, and only there", () => {
    expect(matchChord(ev("ф", { ctrlKey: true, code: "KeyA" }))).toEqual({ kind: "selectAll" });
    expect(matchChord(ev("α", { metaKey: true, code: "KeyA" }))).toEqual({ kind: "selectAll" });
    expect(matchChord(ev("a", { ctrlKey: true, code: "KeyQ" }))).toEqual({ kind: "selectAll" });
    expect(matchChord(ev("q", { ctrlKey: true, code: "KeyA" }))).toBeNull();
    expect(matchChord(ev("ф", { ctrlKey: true, shiftKey: true, code: "KeyA" }))).toBeNull();
    expect(matchChord(ev("ф", { ctrlKey: true, altKey: true, code: "KeyA" }))).toBeNull();
    expect(matchChord(ev("ф", { code: "KeyA" }))).toBeNull();
    expect(matchChord(ev("с", { ctrlKey: true, code: "KeyC" }))).toBeNull();
  });

  it("Ctrl/Cmd+C, X and V resolve to nothing, so the browser fires copy, cut and paste", () => {
    for (const key of ["c", "x", "v", "C", "X", "V"]) {
      for (const mods of [{ ctrlKey: true }, { metaKey: true }, { ctrlKey: true, shiftKey: true }]) {
        expect(matchChord(ev(key, mods)), `${JSON.stringify(mods)}+${key}`).toBeNull();
      }
    }
  });

  it("Delete/Backspace family", () => {
    expect(matchChord(ev("Backspace", { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: "deleteBar",
    });
    expect(matchChord(ev("Backspace", { metaKey: true, shiftKey: true }))).toEqual({
      kind: "deleteBar",
    });
    expect(matchChord(ev("Backspace", { shiftKey: true }))).toEqual({ kind: "deleteBeat" });
    expect(matchChord(ev("Delete", { shiftKey: true }))).toEqual({ kind: "deleteBeat" });
    expect(matchChord(ev("Delete"))).toEqual({ kind: "clearNote" });
    expect(matchChord(ev("Backspace"))).toEqual({ kind: "clearNote" });
  });

  it("Insert / Enter", () => {
    expect(matchChord(ev("Insert"))).toEqual({ kind: "insertBeat" });
    expect(matchChord(ev("Enter", { ctrlKey: true }))).toEqual({ kind: "addBar" });
    expect(matchChord(ev("Enter", { metaKey: true }))).toEqual({ kind: "addBar" });
  });

  it("Enter, the Menu key and Shift+F10 open the note menu; Ctrl+Enter still adds a bar", () => {
    expect(matchChord(ev("Enter"))).toEqual({ kind: "openMenu" });
    expect(matchChord(ev("ContextMenu"))).toEqual({ kind: "openMenu" });
    expect(matchChord(ev("F10", { shiftKey: true }))).toEqual({ kind: "openMenu" });
    expect(matchChord(ev("Enter", { ctrlKey: true }))).toEqual({ kind: "addBar" });
    for (const event of [
      ev("Enter", { shiftKey: true }),
      ev("Enter", { altKey: true }),
      ev("ContextMenu", { shiftKey: true }),
      ev("F10"),
      ev("F10", { ctrlKey: true, shiftKey: true }),
      ev("F10", { shiftKey: true, altKey: true }),
    ]) {
      expect(matchChord(event), JSON.stringify(event)).toBeNull();
    }
  });

  it("a held key's repeat resolves as the key does: the editor drops a repeated openMenu itself", () => {
    expect(matchChord(ev("Enter", { repeat: true }))).toEqual({ kind: "openMenu" });
    expect(matchChord(ev("F10", { shiftKey: true, repeat: true }))).toEqual({ kind: "openMenu" });
    expect(matchChord(ev("ArrowRight", { repeat: true }))).toEqual({ kind: "moveBeat", delta: 1 });
  });

  it("brackets and dot", () => {
    expect(matchChord(ev("["))).toEqual({ kind: "scaleDuration", direction: "halve" });
    expect(matchChord(ev("]"))).toEqual({ kind: "scaleDuration", direction: "double" });
    expect(matchChord(ev("."))).toEqual({ kind: "toggleDotted" });
  });

  it("maps + and - to duration, shifted or not", () => {
    // "+" lengthens the note, "-" shortens it.
    expect(matchChord(ev("-"))).toEqual({ kind: "scaleDuration", direction: "halve" });
    expect(matchChord(ev("="))).toEqual({ kind: "scaleDuration", direction: "double" });
    // On a standard layout "+" is Shift+"=" and "_" is Shift+"-", so these
    // must still match WITH shift held — excluding shift would make "+"
    // unreachable by the key its own name refers to.
    expect(matchChord(ev("+", { shiftKey: true }))).toEqual({
      kind: "scaleDuration",
      direction: "double",
    });
    expect(matchChord(ev("_", { shiftKey: true }))).toEqual({
      kind: "scaleDuration",
      direction: "halve",
    });
  });

  it("maps ? to the shortcut help", () => {
    // `?` is Shift+`/`, so it must match WITH shift held.
    expect(matchChord(ev("?", { shiftKey: true }))).toEqual({ kind: "showHelp" });
    expect(matchChord(ev("?", { ctrlKey: true }))).toBeNull();
    expect(matchChord(ev("?", { metaKey: true }))).toBeNull();
    expect(matchChord(ev("?", { altKey: true }))).toBeNull();
  });

  it("leaves browser zoom alone", () => {
    // Ctrl/Cmd +/-/= is zoom in every major browser.
    for (const key of ["-", "=", "+", "_"]) {
      expect(matchChord(ev(key, { ctrlKey: true })), `Ctrl+${key}`).toBeNull();
      expect(matchChord(ev(key, { metaKey: true })), `Cmd+${key}`).toBeNull();
      expect(matchChord(ev(key, { altKey: true })), `Alt+${key}`).toBeNull();
    }
  });

  it("all ten technique letters", () => {
    for (const [key, technique] of Object.entries(TECHNIQUE_KEYS)) {
      expect(matchChord(ev(key))).toEqual({ kind: "toggleTechnique", technique });
    }
  });

  it("r makes a rest, with or without Shift, never with Ctrl/Cmd/Alt", () => {
    expect(matchChord(ev("r"))).toEqual({ kind: "makeRest" });
    expect(matchChord(ev("R", { shiftKey: true }))).toEqual({ kind: "makeRest" });
    expect(matchChord(ev("r", { ctrlKey: true }))).toBeNull();
    expect(matchChord(ev("r", { metaKey: true }))).toBeNull();
    expect(matchChord(ev("r", { altKey: true }))).toBeNull();
  });

  it("Shift+B fixes the bar; b and Caps Lock + b still bend", () => {
    expect(matchChord(ev("B", { shiftKey: true }))).toEqual({ kind: "fixBar" });
    expect(matchChord(ev("b"))).toEqual({ kind: "toggleTechnique", technique: "bendFull" });
    expect(matchChord(ev("B"))).toEqual({ kind: "toggleTechnique", technique: "bendFull" });
    expect(matchChord(ev("B", { shiftKey: true, altKey: true }))).toBeNull();
    expect(matchChord(ev("B", { shiftKey: true, ctrlKey: true }))).toBeNull();
  });

  it("technique letters are case-insensitive (a real Shift+letter keydown)", () => {
    // A real Shift+h keydown reports key: "H", shiftKey: true — not key:
    // "h" with shiftKey merely set. Confirms the uppercase form some
    // browsers report resolves the same as the bare lowercase key.
    expect(matchChord(ev("H", { shiftKey: true }))).toEqual({
      kind: "toggleTechnique",
      technique: "hammer",
    });
  });

  it("space -> playPause (both the modern and legacy key values)", () => {
    expect(matchChord(ev(" "))).toEqual({ kind: "playPause" });
    expect(matchChord(ev("Spacebar"))).toEqual({ kind: "playPause" });
  });

  it("Ctrl/Cmd+Z -> undo, +Shift -> redo", () => {
    expect(matchChord(ev("z", { ctrlKey: true }))).toEqual({ kind: "undo" });
    expect(matchChord(ev("z", { metaKey: true }))).toEqual({ kind: "undo" });
    expect(matchChord(ev("z", { ctrlKey: true, shiftKey: true }))).toEqual({ kind: "redo" });
    expect(matchChord(ev("z", { metaKey: true, shiftKey: true }))).toEqual({ kind: "redo" });
  });
});

describe("matchChord — ordering (most-specific chord wins, others fall through correctly)", () => {
  it("Ctrl+Shift+Backspace -> deleteBar, Shift+Backspace -> deleteBeat, plain Backspace -> clearNote", () => {
    expect(matchChord(ev("Backspace", { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: "deleteBar",
    });
    expect(matchChord(ev("Backspace", { shiftKey: true }))).toEqual({ kind: "deleteBeat" });
    expect(matchChord(ev("Backspace"))).toEqual({ kind: "clearNote" });
  });
});

describe("matchChord — known collisions resolve to null (regressions from review rounds 1-3)", () => {
  const cases: Array<[string, ChordEvent]> = [
    ["Ctrl+Shift+Delete (old deleteBar chord; opens 'clear browsing data')", ev("Delete", { ctrlKey: true, shiftKey: true })],
    ["Cmd+[ (macOS browser Back)", ev("[", { metaKey: true })],
    ["Cmd+] (macOS browser Forward)", ev("]", { metaKey: true })],
    ["Cmd+. (macOS stop-loading)", ev(".", { metaKey: true })],
    ["Ctrl+S (Save)", ev("s", { ctrlKey: true })],
    ["Ctrl+P (Print)", ev("p", { ctrlKey: true })],
    ["Ctrl+T (New tab)", ev("t", { ctrlKey: true })],
    ["Ctrl+N (New window)", ev("n", { ctrlKey: true })],
    ["Ctrl+H (History)", ev("h", { ctrlKey: true })],
    ["Ctrl+L (focus address bar)", ev("l", { ctrlKey: true })],
    ["Ctrl+B (bookmarks bar)", ev("b", { ctrlKey: true })],
    ["Ctrl+1 (switch to browser tab 1)", ev("1", { ctrlKey: true })],
    ["Alt+ArrowLeft (browser back)", ev("ArrowLeft", { altKey: true })],
    ["Alt+ArrowRight (browser forward)", ev("ArrowRight", { altKey: true })],
    ["Shift+Insert (X11 paste-from-selection)", ev("Insert", { shiftKey: true })],
    ["Ctrl+Insert (classic copy)", ev("Insert", { ctrlKey: true })],
    ["Alt+Space (Windows system menu)", ev(" ", { altKey: true })],
    ["Ctrl+Space (OS input-method toggle)", ev(" ", { ctrlKey: true })],
    ["Cmd+Space (macOS Spotlight)", ev(" ", { metaKey: true })],
    ["Ctrl+Shift+A (Chrome tab search)", ev("A", { ctrlKey: true, shiftKey: true })],
    ["Shift+Escape (Chrome task manager)", ev("Escape", { shiftKey: true })],
    ["Ctrl+D (bookmark this page)", ev("d", { ctrlKey: true })],
  ];

  it.each(cases)("%s -> null", (_label, event) => {
    expect(matchChord(event)).toBeNull();
  });
});

describe("matchChord — exhaustive modifier cross-product", () => {
  // Independently re-derived from the spec tables across review rounds 1-3
  // (not from keymap.ts's own control flow) as one predicate per DISTINCT
  // binding, so that "no event matches two commands" is checked directly —
  // by counting how many of these predicates fire for a given event — not
  // inferred from matchChord's own single return value, which could hide an
  // ambiguity behind whichever branch happens to run first.
  interface Binding {
    name: string;
    matches: (e: ChordEvent) => boolean;
    command: (e: ChordEvent) => ChordCommand;
  }

  const ctrlOrMeta = (e: ChordEvent) => e.ctrlKey || e.metaKey;

  const bindings: Binding[] = [
    {
      name: "undo",
      matches: (e) => ctrlOrMeta(e) && !e.shiftKey && e.key.toLowerCase() === "z",
      command: () => ({ kind: "undo" }),
    },
    {
      name: "redo",
      matches: (e) => ctrlOrMeta(e) && e.shiftKey && e.key.toLowerCase() === "z",
      command: () => ({ kind: "redo" }),
    },
    {
      name: "playPause",
      matches: (e) => !ctrlOrMeta(e) && !e.altKey && (e.key === " " || e.key === "Spacebar"),
      command: () => ({ kind: "playPause" }),
    },
    {
      name: "setFret",
      matches: (e) => !ctrlOrMeta(e) && /^[0-9]$/.test(e.key),
      command: (e) => ({ kind: "setFret", digit: Number(e.key) }),
    },
    {
      name: "moveBeat:left",
      matches: (e) => !e.altKey && !e.shiftKey && e.key === "ArrowLeft",
      command: () => ({ kind: "moveBeat", delta: -1 }),
    },
    {
      name: "moveBeat:right",
      matches: (e) => !e.altKey && !e.shiftKey && e.key === "ArrowRight",
      command: () => ({ kind: "moveBeat", delta: 1 }),
    },
    {
      name: "extendSelection",
      matches: (e) => !e.altKey && e.shiftKey && !ctrlOrMeta(e) && (e.key === "ArrowLeft" || e.key === "ArrowRight"),
      command: (e) => ({ kind: "extendSelection", delta: e.key === "ArrowLeft" ? -1 : 1 }),
    },
    {
      name: "extendSelectionToBar",
      matches: (e) => !e.altKey && e.shiftKey && ctrlOrMeta(e) && (e.key === "ArrowLeft" || e.key === "ArrowRight"),
      command: (e) => ({ kind: "extendSelectionToBar", delta: e.key === "ArrowLeft" ? -1 : 1 }),
    },
    {
      name: "selectAll",
      // The A key: the letter it types, or — on a layout whose letters are not Latin — the key itself.
      matches: (e) =>
        ctrlOrMeta(e) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === "a" || (e.code === "KeyA" && !/^[a-z]$/i.test(e.key))),
      command: () => ({ kind: "selectAll" }),
    },
    {
      name: "clearSelection",
      matches: (e) => e.key === "Escape" && !ctrlOrMeta(e) && !e.shiftKey && !e.altKey,
      command: () => ({ kind: "clearSelection" }),
    },
    {
      name: "duplicate",
      matches: (e) => !ctrlOrMeta(e) && !e.altKey && (e.key === "d" || e.key === "D"),
      command: () => ({ kind: "duplicate" }),
    },
    {
      name: "moveString:up",
      matches: (e) => !e.altKey && e.key === "ArrowUp",
      command: () => ({ kind: "moveString", delta: -1 }),
    },
    {
      name: "moveString:down",
      matches: (e) => !e.altKey && e.key === "ArrowDown",
      command: () => ({ kind: "moveString", delta: 1 }),
    },
    {
      name: "deleteBar",
      matches: (e) => e.key === "Backspace" && ctrlOrMeta(e) && e.shiftKey,
      command: () => ({ kind: "deleteBar" }),
    },
    {
      name: "deleteBeat",
      matches: (e) => (e.key === "Delete" || e.key === "Backspace") && e.shiftKey && !ctrlOrMeta(e),
      command: () => ({ kind: "deleteBeat" }),
    },
    {
      name: "clearNote",
      matches: (e) => (e.key === "Delete" || e.key === "Backspace") && !e.shiftKey,
      command: () => ({ kind: "clearNote" }),
    },
    {
      name: "addBar",
      matches: (e) => e.key === "Enter" && ctrlOrMeta(e),
      command: () => ({ kind: "addBar" }),
    },
    {
      name: "insertBeat",
      matches: (e) => e.key === "Insert" && !e.shiftKey && !ctrlOrMeta(e),
      command: () => ({ kind: "insertBeat" }),
    },
    {
      name: "openMenu",
      matches: (e) =>
        !ctrlOrMeta(e) &&
        !e.altKey &&
        (((e.key === "Enter" || e.key === "ContextMenu") && !e.shiftKey) || (e.key === "F10" && e.shiftKey)),
      command: () => ({ kind: "openMenu" }),
    },
    {
      name: "showHelp",
      matches: (e) => !ctrlOrMeta(e) && !e.altKey && e.key === "?",
      command: () => ({ kind: "showHelp" }),
    },
    {
      name: "scaleDuration:halve",
      matches: (e) =>
        !ctrlOrMeta(e) && !e.altKey && (e.key === "[" || e.key === "-" || e.key === "_"),
      command: () => ({ kind: "scaleDuration", direction: "halve" }),
    },
    {
      name: "scaleDuration:double",
      matches: (e) =>
        !ctrlOrMeta(e) && !e.altKey && (e.key === "]" || e.key === "+" || e.key === "="),
      command: () => ({ kind: "scaleDuration", direction: "double" }),
    },
    {
      name: "toggleDotted",
      matches: (e) => !ctrlOrMeta(e) && !e.altKey && e.key === ".",
      command: () => ({ kind: "toggleDotted" }),
    },
    {
      name: "toggleTie",
      matches: (e) => !ctrlOrMeta(e) && !e.altKey && e.key === "i",
      command: () => ({ kind: "toggleTie" }),
    },
    {
      name: "toggleTuplet",
      matches: (e) => !ctrlOrMeta(e) && !e.altKey && e.key === "u",
      command: () => ({ kind: "toggleTuplet" }),
    },
    {
      name: "makeRest",
      matches: (e) => !ctrlOrMeta(e) && !e.altKey && (e.key === "r" || e.key === "R"),
      command: () => ({ kind: "makeRest" }),
    },
    {
      name: "fixBar",
      matches: (e) => !ctrlOrMeta(e) && !e.altKey && e.shiftKey && e.key.toLowerCase() === "b",
      command: () => ({ kind: "fixBar" }),
    },
    {
      name: "toggleTechnique",
      // Shift+B is fixBar's (above), and with Alt as well it is nothing.
      matches: (e) =>
        !ctrlOrMeta(e) &&
        e.key.length === 1 &&
        !!TECHNIQUE_KEYS[e.key.toLowerCase()] &&
        !(e.shiftKey && e.key.toLowerCase() === "b"),
      command: (e) => ({
        kind: "toggleTechnique",
        technique: TECHNIQUE_KEYS[e.key.toLowerCase()] as Technique,
      }),
    },
  ];

  const BOUND_KEYS = [
    ...Array.from({ length: 10 }, (_, d) => String(d)), // "0".."9"
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Delete",
    "Backspace",
    "Insert",
    "Enter",
    "ContextMenu", // the Menu key opens the note menu, like Enter
    "F10", // with Shift
    "[",
    "]",
    "-",
    "_",
    "?",
    "+",
    "=",
    ".",
    ...Object.keys(TECHNIQUE_KEYS), // h s p v x g t n l b
    "i", // tie — a letter, so it has to be proven exclusive of the above
    "u", // triplet, likewise
    "r", // rest, likewise
    "R",
    "B", // Shift+B fixes the bar; Caps Lock + b still bends
    "z",
    " ",
    "Spacebar",
    "a", // Ctrl/Cmd+A selects all; bare a is nothing
    "A",
    "d", // duplicate
    "D",
    "Escape", // clears the selection
    // Deliberately unbound, as a sanity check that they resolve to null
    // across every modifier combination too, not just the default one.
    "q",
    "Tab",
    "c", // Ctrl+C, X and V belong to the browser's clipboard events
    "v",
  ];
  // Keys as a layout types them, with where they are: Cyrillic on the A, C and V keys, and AZERTY's
  // A and Q (where QWERTY has Q and A). The letter a Latin layout types is the one that counts.
  const CODED_KEYS: Array<[key: string, code: string]> = [
    ["ф", "KeyA"],
    ["с", "KeyC"],
    ["м", "KeyV"],
    ["a", "KeyQ"],
    ["q", "KeyA"],
  ];
  const BOOL = [false, true];

  it("matches exactly the independently-derived expectation for every (key, modifier) combination, and no event ever satisfies two bindings' predicates", () => {
    let checked = 0;
    const keys: Array<[string, string | undefined]> = [...BOUND_KEYS.map((key) => [key, undefined] as [string, undefined]), ...CODED_KEYS];
    for (const [key, code] of keys) {
      for (const ctrlKey of BOOL) {
        for (const metaKey of BOOL) {
          for (const shiftKey of BOOL) {
            for (const altKey of BOOL) {
              const event: ChordEvent = { key, ...(code ? { code } : {}), ctrlKey, metaKey, shiftKey, altKey };
              const matches = bindings.filter((b) => b.matches(event));
              const label = `key=${JSON.stringify(key)} code=${code ?? "-"} ctrl=${ctrlKey} meta=${metaKey} shift=${shiftKey} alt=${altKey}`;

              expect(matches.length, `${label} — matched ${matches.map((m) => m.name).join(", ")}`).toBeLessThanOrEqual(1);

              const want = matches.length === 1 ? matches[0].command(event) : null;
              expect(matchChord(event), label).toEqual(want);
              checked++;
            }
          }
        }
      }
    }
    // Sanity check on the test itself: make sure the loop actually ran
    // over the full cross-product rather than silently iterating zero
    // times (e.g. an empty BOUND_KEYS from a typo).
    expect(checked).toBe((BOUND_KEYS.length + CODED_KEYS.length) * 16);
  });
});

describe("claims", () => {
  const ESCAPE: ChordCommand = { kind: "clearSelection" };

  it("leaves Escape to bubble with no selection, so it still closes what listens on the window", () => {
    expect(claims(ESCAPE, { selecting: false, helpOpen: false })).toBe(false);
  });

  it("leaves Escape to the shortcuts panel while it is open, selection or not", () => {
    expect(claims(ESCAPE, { selecting: true, helpOpen: true })).toBe(false);
    expect(claims(ESCAPE, { selecting: false, helpOpen: true })).toBe(false);
  });

  it("takes Escape to clear a selection", () => {
    expect(claims(ESCAPE, { selecting: true, helpOpen: false })).toBe(true);
  });

  it("takes Escape to close the note menu while it shows, selection or not", () => {
    expect(claims(ESCAPE, { selecting: false, helpOpen: false, menuShown: true })).toBe(true);
    expect(claims(ESCAPE, { selecting: true, helpOpen: false, menuShown: true })).toBe(true);
    expect(claims(ESCAPE, { selecting: false, helpOpen: false, menuShown: false })).toBe(false);
  });

  it("leaves Escape to the shortcuts panel while it is open, menu or not", () => {
    expect(claims(ESCAPE, { selecting: false, helpOpen: true, menuShown: true })).toBe(false);
    expect(claims(ESCAPE, { selecting: true, helpOpen: true, menuShown: true })).toBe(false);
  });

  it("takes every other chord, whatever the state", () => {
    expect(claims({ kind: "moveBeat", delta: 1 }, { selecting: false, helpOpen: true })).toBe(true);
  });
});

// One command of every kind. A mapped type, so a kind added to keymap.ts is a
// compile error here until it is given an example, and a row in each table below.
const EVERY_KIND: { [K in ChordCommand["kind"]]: Extract<ChordCommand, { kind: K }> } = {
  setFret: { kind: "setFret", digit: 5 },
  moveBeat: { kind: "moveBeat", delta: 1 },
  moveString: { kind: "moveString", delta: -1 },
  clearNote: { kind: "clearNote" },
  insertBeat: { kind: "insertBeat" },
  deleteBeat: { kind: "deleteBeat" },
  addBar: { kind: "addBar" },
  deleteBar: { kind: "deleteBar" },
  scaleDuration: { kind: "scaleDuration", direction: "halve" },
  toggleDotted: { kind: "toggleDotted" },
  toggleTechnique: { kind: "toggleTechnique", technique: "hammer" },
  toggleTie: { kind: "toggleTie" },
  toggleTuplet: { kind: "toggleTuplet" },
  makeRest: { kind: "makeRest" },
  fixBar: { kind: "fixBar" },
  extendSelection: { kind: "extendSelection", delta: 1 },
  extendSelectionToBar: { kind: "extendSelectionToBar", delta: -1 },
  selectAll: { kind: "selectAll" },
  clearSelection: { kind: "clearSelection" },
  duplicate: { kind: "duplicate" },
  playPause: { kind: "playPause" },
  undo: { kind: "undo" },
  redo: { kind: "redo" },
  showHelp: { kind: "showHelp" },
  openMenu: { kind: "openMenu" },
};
const STATES = [
  { selecting: false, helpOpen: false },
  { selecting: true, helpOpen: false },
  { selecting: false, helpOpen: true },
  { selecting: true, helpOpen: true },
];

describe("claims and actsOnSelection, kind by kind", () => {
  // Whether the editor takes the chord with nothing selected and the help closed,
  // and with a selection: every kind but Escape's, whatever the state.
  const CLAIMED: Record<ChordCommand["kind"], { idle: boolean; selecting: boolean }> = {
    setFret: { idle: true, selecting: true },
    moveBeat: { idle: true, selecting: true },
    moveString: { idle: true, selecting: true },
    clearNote: { idle: true, selecting: true },
    insertBeat: { idle: true, selecting: true },
    deleteBeat: { idle: true, selecting: true },
    addBar: { idle: true, selecting: true },
    deleteBar: { idle: true, selecting: true },
    scaleDuration: { idle: true, selecting: true },
    toggleDotted: { idle: true, selecting: true },
    toggleTechnique: { idle: true, selecting: true },
    toggleTie: { idle: true, selecting: true },
    toggleTuplet: { idle: true, selecting: true },
    makeRest: { idle: true, selecting: true },
    fixBar: { idle: true, selecting: true },
    extendSelection: { idle: true, selecting: true },
    extendSelectionToBar: { idle: true, selecting: true },
    selectAll: { idle: true, selecting: true },
    clearSelection: { idle: false, selecting: true },
    duplicate: { idle: true, selecting: true },
    playPause: { idle: true, selecting: true },
    undo: { idle: true, selecting: true },
    redo: { idle: true, selecting: true },
    showHelp: { idle: true, selecting: true },
    openMenu: { idle: true, selecting: true },
  };

  it.each(Object.entries(CLAIMED))("%s is claimed as the table says, and with the help open only if it is not Escape's", (kind, want) => {
    const command = EVERY_KIND[kind as ChordCommand["kind"]];
    expect(claims(command, STATES[0]), "idle").toBe(want.idle);
    expect(claims(command, STATES[1]), "selecting").toBe(want.selecting);
    for (const state of STATES.slice(2)) expect(claims(command, state), JSON.stringify(state)).toBe(kind !== "clearSelection");
  });

  // Whether the command acts on the selection; every other one clears it first.
  const ACTS: Record<ChordCommand["kind"], boolean> = {
    setFret: false,
    moveBeat: false,
    moveString: false,
    clearNote: true,
    insertBeat: false,
    deleteBeat: true,
    addBar: false,
    deleteBar: false,
    scaleDuration: false,
    toggleDotted: false,
    toggleTechnique: false,
    toggleTie: false,
    toggleTuplet: false,
    makeRest: false,
    fixBar: false,
    extendSelection: true,
    extendSelectionToBar: true,
    selectAll: true,
    clearSelection: true,
    duplicate: true,
    playPause: false,
    undo: false,
    redo: false,
    showHelp: false,
    openMenu: true,
  };

  it.each(Object.entries(ACTS))("%s acts on the selection: %s", (kind, acts) => {
    expect(actsOnSelection(kind as ChordCommand["kind"])).toBe(acts);
  });

  it.each(Object.keys(EVERY_KIND))("%s is claimed while the note menu shows", (kind) => {
    const command = EVERY_KIND[kind as ChordCommand["kind"]];
    expect(claims(command, { selecting: false, helpOpen: false, menuShown: true })).toBe(true);
  });

  // Whether the command closes an open note menu whatever it did (spec §1's table). The rest keep it
  // open unless the caret moved or a selection came or went, which the editor checks.
  const CLOSES: Record<ChordCommand["kind"], boolean> = {
    setFret: false,
    moveBeat: false,
    moveString: false,
    clearNote: false,
    insertBeat: true,
    deleteBeat: true,
    addBar: true,
    deleteBar: true,
    scaleDuration: false,
    toggleDotted: false,
    toggleTechnique: false,
    toggleTie: false,
    toggleTuplet: false,
    makeRest: false,
    fixBar: true,
    extendSelection: false,
    extendSelectionToBar: false,
    selectAll: true,
    clearSelection: true,
    duplicate: true,
    playPause: true,
    undo: true,
    redo: true,
    showHelp: true,
    openMenu: false,
  };

  it.each(Object.entries(CLOSES))("%s closes the note menu: %s", (kind, closes) => {
    expect(closesMenu(kind as ChordCommand["kind"])).toBe(closes);
  });
});

describe("clipboardChord: the keys the browser turns into copy, cut and paste", () => {
  it("Ctrl/Cmd+C copies, X cuts, V pastes over and Shift+V in front", () => {
    expect(clipboardChord(ev("c", { ctrlKey: true }))).toBe("copy");
    expect(clipboardChord(ev("C", { metaKey: true }))).toBe("copy");
    expect(clipboardChord(ev("x", { ctrlKey: true }))).toBe("cut");
    expect(clipboardChord(ev("v", { ctrlKey: true }))).toBe("paste");
    expect(clipboardChord(ev("V", { ctrlKey: true, shiftKey: true }))).toBe("pasteInsert");
    expect(clipboardChord(ev("v", { metaKey: true, shiftKey: true }))).toBe("pasteInsert");
  });

  it("Shift+Insert pastes and Ctrl+Insert copies, as the browser has them", () => {
    expect(clipboardChord(ev("Insert", { shiftKey: true }))).toBe("paste");
    expect(clipboardChord(ev("Insert", { ctrlKey: true }))).toBe("copy");
    expect(clipboardChord(ev("Insert"))).toBeNull();
    expect(clipboardChord(ev("Insert", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  it("by the physical key on a layout whose letters are not Latin; a Latin layout's own letter wins", () => {
    expect(clipboardChord(ev("с", { ctrlKey: true, code: "KeyC" }))).toBe("copy");
    expect(clipboardChord(ev("ч", { ctrlKey: true, code: "KeyX" }))).toBe("cut");
    expect(clipboardChord(ev("м", { ctrlKey: true, code: "KeyV" }))).toBe("paste");
    expect(clipboardChord(ev("М", { ctrlKey: true, shiftKey: true, code: "KeyV" }))).toBe("pasteInsert");
    // Dvorak types k on the V key, and v on QWERTY's period: the letter is what counts
    expect(clipboardChord(ev("k", { ctrlKey: true, code: "KeyV" }))).toBeNull();
    expect(clipboardChord(ev("v", { ctrlKey: true, code: "Period" }))).toBe("paste");
  });

  it("is nothing else: no modifier, Alt (AltGr is Ctrl+Alt), Ctrl+Shift+C or X, another letter, Shift+Delete", () => {
    expect(clipboardChord(ev("v"))).toBeNull();
    expect(clipboardChord(ev("v", { shiftKey: true }))).toBeNull();
    expect(clipboardChord(ev("v", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(clipboardChord(ev("c", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(clipboardChord(ev("x", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(clipboardChord(ev("a", { ctrlKey: true }))).toBeNull();
    expect(clipboardChord(ev("z", { ctrlKey: true }))).toBeNull();
    // the browser's cut, but the editor's: Shift+Delete removes beats, and never reaches the browser
    expect(clipboardChord(ev("Delete", { shiftKey: true }))).toBeNull();
  });

  it("is never a keymap command, so its keydown is left to the browser", () => {
    for (const event of [
      ev("c", { ctrlKey: true }),
      ev("x", { metaKey: true }),
      ev("v", { ctrlKey: true, shiftKey: true }),
      ev("Insert", { shiftKey: true }),
      ev("Insert", { ctrlKey: true }),
      ev("м", { ctrlKey: true, code: "KeyV" }),
    ]) {
      expect(clipboardChord(event), JSON.stringify(event)).not.toBeNull();
      expect(matchChord(event), JSON.stringify(event)).toBeNull();
    }
  });
});
