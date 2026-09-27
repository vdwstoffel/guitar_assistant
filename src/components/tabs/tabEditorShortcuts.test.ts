import { describe, it, expect } from "vitest";
import { matchChord, type ChordEvent } from "../../lib/tabscore/keymap";
import { TAB_EDITOR_SHORTCUTS } from "./tabEditorShortcuts";

// Maps a help entry's printed keys back to the event matchChord would see.
const MODIFIERS = new Set(["Ctrl", "Cmd", "Shift", "Alt"]);
const PRINTED_TO_KEY: Record<string, string> = {
  "←": "ArrowLeft",
  "→": "ArrowRight",
  "↑": "ArrowUp",
  "↓": "ArrowDown",
  Space: " ",
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
      .filter((i) => !i.mouse)
      .map((i) => [`${g.group}: ${i.keys.join("+")}`, i.keys] as const),
  );

  for (const [name, keys] of entries) {
    it(`${name} still resolves to a command`, () => {
      expect(matchChord(toEvent([...keys])), name).not.toBeNull();
    });
  }

  it("covers a real number of entries (guards a silently emptied list)", () => {
    expect(entries.length).toBeGreaterThan(20);
  });
});
