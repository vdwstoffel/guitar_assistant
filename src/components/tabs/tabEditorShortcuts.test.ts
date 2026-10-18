import { describe, it, expect } from "vitest";
import { matchChord, type ChordCommand, type ChordEvent } from "../../lib/tabscore/keymap";
import { TAB_EDITOR_SHORTCUTS } from "./tabEditorShortcuts";

// Maps a help entry's printed keys back to the event matchChord would see.
const MODIFIERS = new Set(["Ctrl", "Cmd", "Shift", "Alt"]);
const PRINTED_TO_KEY: Record<string, string> = {
  "←": "ArrowLeft",
  "→": "ArrowRight",
  "↑": "ArrowUp",
  "↓": "ArrowDown",
  Space: " ",
  Esc: "Escape",
};
// Keys that only exist in their shifted form on a standard layout.
const IMPLIES_SHIFT = new Set(["+", "?"]);

function toEvent(keys: string[]): ChordEvent {
  const mods = keys.filter((k) => MODIFIERS.has(k));
  const main = keys.find((k) => !MODIFIERS.has(k))!;
  const key = PRINTED_TO_KEY[main] ?? main;
  return {
    key,
    ctrlKey: mods.includes("Ctrl") || mods.includes("Cmd"),
    metaKey: false,
    shiftKey: mods.includes("Shift") || IMPLIES_SHIFT.has(key),
    altKey: mods.includes("Alt"),
  };
}

describe("the ? help panel does not drift from the keymap", () => {
  const entries = TAB_EDITOR_SHORTCUTS.flatMap((g) =>
    g.items
      .filter((i) => !i.mouse && !i.clipboard)
      .map((i) => [`${g.group}: ${i.keys.join("+")}`, i.keys] as const),
  );

  for (const [name, keys] of entries) {
    it(`${name} still resolves to a command`, () => {
      expect(matchChord(toEvent([...keys])), name).not.toBeNull();
    });
  }

  // Not just "resolves to something": the keys the help names for a rest and
  // for fixing a bar do exactly that, and b is still a bend.
  it.each([
    ["r", "makeRest"],
    ["Shift+B", "fixBar"],
    ["b", "toggleTechnique"],
    ["Shift+→", "extendSelection"],
    ["Ctrl+Shift+→", "extendSelectionToBar"],
    ["Ctrl+A", "selectAll"],
    ["Esc", "clearSelection"],
    ["d", "duplicate"],
    ["Enter", "openMenu"],
    ["Shift+F10", "openMenu"],
  ] as Array<[string, ChordCommand["kind"]]>)("%s is listed and resolves to %s", (printed, kind) => {
    const entry = entries.find(([, keys]) => keys.join("+") === printed);
    expect(entry, printed).toBeDefined();
    expect(matchChord(toEvent([...entry![1]]))?.kind).toBe(kind);
  });

  // The clipboard chords are listed, and are deliberately not keymap
  // commands: a keydown the editor claimed would never become a copy, cut or
  // paste event.
  it.each(["Ctrl+C", "Ctrl+X", "Ctrl+V", "Ctrl+Shift+V"])("%s is listed and left to the browser", (printed) => {
    const item = TAB_EDITOR_SHORTCUTS.flatMap((g) => g.items).find((i) => i.keys.join("+") === printed);
    expect(item?.clipboard, printed).toBe(true);
    expect(matchChord(toEvent([...item!.keys]))).toBeNull();
  });

  it("covers a real number of entries (guards a silently emptied list)", () => {
    expect(entries.length).toBeGreaterThan(20);
  });
});
