import { describe, it, expect } from "vitest";
import { matchChord, type ChordEvent, type ChordCommand } from "./keymap";
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
      matches: (e) => !e.altKey && e.key === "ArrowLeft",
      command: () => ({ kind: "moveBeat", delta: -1 }),
    },
    {
      name: "moveBeat:right",
      matches: (e) => !e.altKey && e.key === "ArrowRight",
      command: () => ({ kind: "moveBeat", delta: 1 }),
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
      name: "toggleTechnique",
      matches: (e) => !ctrlOrMeta(e) && e.key.length === 1 && !!TECHNIQUE_KEYS[e.key.toLowerCase()],
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
    "z",
    " ",
    "Spacebar",
    // Deliberately unbound, as a sanity check that they resolve to null
    // across every modifier combination too, not just the default one.
    "a",
    "q",
    "Tab",
    "Escape",
  ];
  const BOOL = [false, true];

  it("matches exactly the independently-derived expectation for every (key, modifier) combination, and no event ever satisfies two bindings' predicates", () => {
    let checked = 0;
    for (const key of BOUND_KEYS) {
      for (const ctrlKey of BOOL) {
        for (const metaKey of BOOL) {
          for (const shiftKey of BOOL) {
            for (const altKey of BOOL) {
              const event: ChordEvent = { key, ctrlKey, metaKey, shiftKey, altKey };
              const matches = bindings.filter((b) => b.matches(event));
              const label = `key=${JSON.stringify(key)} ctrl=${ctrlKey} meta=${metaKey} shift=${shiftKey} alt=${altKey}`;

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
    expect(checked).toBe(BOUND_KEYS.length * 16);
  });
});
