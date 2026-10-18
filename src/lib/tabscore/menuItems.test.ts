import { describe, it, expect } from "vitest";
import { menuItems, menuStaysOpen, menuStep, type MenuGroup, type MenuInput, type MenuItem } from "./menuItems";
import { parseTex } from "./parse";
import { refusedNotice } from "./barMessages";
import { clipboardChord, matchChord, type ChordEvent } from "./keymap";
import { TECHNIQUES } from "./commands/technique";
import { NO_NOTE_REASON, NOTHING_TO_PASTE, NOTHING_TO_TIE_NOTICE, PARSE_REASON } from "./menuMessages";
import type { Caret } from "./locate";
import type { Range } from "./selection";

const doc = (body: string) => `\\tempo 120\n.\n${body}\n`;
const at = (barIndex: number, beatIndex: number, string = 6): Caret => ({ barIndex, beatIndex, string });
const SECURE = { secure: true, hasFallbackClip: false };

function menu(body: string, caret: Caret, more: Partial<MenuInput> = {}): MenuGroup[] {
  const tex = doc(body);
  return menuItems({ tex, parsed: parseTex(tex), caret, selection: null, clipboard: SECURE, ...more });
}
const items = (groups: MenuGroup[]) => groups.flatMap((g) => g.items);
const find = (groups: MenuGroup[], id: string): MenuItem => {
  const found = items(groups).find((i) => i.id === id);
  if (!found) throw new Error(`no item ${id} in ${items(groups).map((i) => i.id).join(", ")}`);
  return found;
};

// Bar 1: a hammer-on, then three plain quarters. Bar 2: a note, a tie to it, a rest, a chord.
const BODY = "3.6{h}.4 5.6 7.6 8.6 | 3.6.4 -.6 r (5.5{v} 7.4)";

describe("menuItems: the note menu", () => {
  it("has five groups, in order, with the spec's items and keys", () => {
    const groups = menu(BODY, at(0, 1));
    expect(groups.map((g) => g.label)).toEqual(["Length", "Techniques", "Tie", "Edit", "Bar"]);
    const shown = (label: string) =>
      groups.find((g) => g.label === label)!.items.map((i) => (i.keyHint ? `${i.label} (${i.keyHint})` : i.label));
    expect(shown("Length")).toEqual(["Shorter (-)", "Longer (+)", "Dotted (.)", "Triplet (u)", "Rest (r)"]);
    expect(shown("Techniques")).toEqual([
      "Hammer-on / Pull-off (h)", "Slide (s)", "Palm mute (p)", "Vibrato (v)", "Dead note (x)", "Ghost note (g)",
      "Tap (t)", "Harmonic (n)", "Let ring (l)", "Bend (b)", "Bend (half)", "Bend & release", "Pre-bend",
    ]);
    expect(shown("Tie")).toEqual(["Tie (i)"]);
    expect(shown("Edit")).toEqual([
      "Cut (Ctrl+X)", "Copy (Ctrl+C)", "Paste (Ctrl+V)", "Paste in front (Ctrl+Shift+V)", "Duplicate bar (d)",
      "Clear (Delete)", "Delete beat (Shift+Delete)", "Delete bar (Ctrl+Shift+Backspace)",
    ]);
    expect(shown("Bar")).toEqual(["Insert beat (Insert)"]);
  });

  it("on a note: everything enabled but Tie, with nothing earlier on the string to tie to", () => {
    const groups = menu(BODY, at(0, 0));
    expect(items(groups).filter((i) => !i.enabled).map((i) => [i.id, i.reason])).toEqual([["tie", NOTHING_TO_TIE_NOTICE]]);
  });

  it("on a rest: techniques and Clear say there is no note; Tie ties through it", () => {
    const groups = menu(BODY, at(1, 2));
    for (const technique of TECHNIQUES) expect(find(groups, technique)).toMatchObject({ enabled: false, reason: NO_NOTE_REASON });
    expect(find(groups, "clear")).toMatchObject({ enabled: false, reason: NO_NOTE_REASON });
    expect(find(groups, "tie")).toMatchObject({ enabled: true, pressed: false });
    expect(find(groups, "shorter").enabled).toBe(true);
  });

  it("on a chord's note: that note's techniques are pressed", () => {
    const groups = menu(BODY, at(1, 3, 5));
    expect(items(groups).filter((i) => i.pressed).map((i) => i.id)).toEqual(["vibrato"]);
    expect(find(groups, "clear").enabled).toBe(true);
  });

  it("on a tie: Tie is pressed, and unties", () => {
    expect(find(menu(BODY, at(1, 1)), "tie")).toMatchObject({ enabled: true, pressed: true, keyHint: "i" });
  });

  it("presses each technique, and Triplet, as written", () => {
    const groups = menu("3.6{h sl pm v x g lht nh lr b (0 2)}.8{tu 3} r{tu 3} r{tu 3}", at(0, 0));
    expect(TECHNIQUES.filter((t) => find(groups, t).pressed)).toEqual([
      "hammer", "slide", "palmMute", "vibrato", "dead", "ghost", "tap", "harmonic", "letRing", "bendHalf",
    ]);
    expect(find(groups, "triplet").pressed).toBe(true);
    expect(find(menu(BODY, at(0, 0)), "triplet").pressed).toBe(false);
    // Another tuplet is not a triplet: pressing Triplet there would not take it off.
    expect(find(menu("3.6.8{tu 5} r{tu 5} r{tu 5} r{tu 5} r{tu 5} r.8 r.8 r.8 r.8", at(0, 0)), "triplet").pressed).toBe(false);
  });

  it("a technique item on an empty string is disabled: No note on this string", () => {
    expect(find(menu(BODY, at(0, 0, 2)), "hammer")).toMatchObject({ enabled: false, reason: "No note on this string" });
  });

  it("offers Fix bar only in a bar that does not add up", () => {
    expect(find(menu("3.6.4 5.6 7.6", at(0, 0)), "fixBar")).toMatchObject({ enabled: true, keyHint: "Shift+B" });
    expect(items(menu(BODY, at(0, 0))).some((i) => i.id === "fixBar")).toBe(false);
  });

  it("offers Fix bar in a bar that is too long, as in one that is too short", () => {
    const body = "3.6.4 5.6 7.6 8.6 | 3.6.4 5.6 7.6 8.6 9.6";
    expect(find(menu(body, at(1, 0)), "fixBar")).toMatchObject({ enabled: true, keyHint: "Shift+B" });
    // The caret's bar decides: the first bar of the same tab adds up.
    expect(items(menu(body, at(0, 0))).some((i) => i.id === "fixBar")).toBe(false);
  });

  it("shows Fix bar disabled, naming the bar, when the bar that is short is one the commands cannot read", () => {
    const groups = menu('3.6.4 5.6 7.6 8.6 | 3.6.4 5.6{ch "Am"} 7.6', at(1, 0));
    expect(find(groups, "fixBar")).toMatchObject({ enabled: false, reason: refusedNotice(1, "fix") });
  });

  it("in a bar the commands cannot read, disables what rewrites it, naming the bar", () => {
    const groups = menu('3.6.4 5.6 | 3.6.4 5.6{ch "Am"} 7.6 8.6', at(1, 0));
    expect(find(groups, "shorter")).toMatchObject({ enabled: false, reason: "Can't change bar 2 automatically — edit it in the source" });
    // Every length item, not only Shorter: Triplet's only check is this one.
    for (const id of ["shorter", "longer", "dotted", "triplet", "rest"]) {
      expect(find(groups, id), id).toMatchObject({ enabled: false, reason: refusedNotice(1, "change") });
    }
    expect(find(groups, "hammer").reason).toBe("Can't change bar 2 automatically — edit it in the source");
    // Tie and Clear are held back too, though `i` and Delete would still act in this bar.
    expect(find(groups, "tie")).toMatchObject({ enabled: false, reason: refusedNotice(1, "change") });
    expect(find(groups, "clear")).toMatchObject({ enabled: false, reason: refusedNotice(1, "change") });
    expect(find(groups, "cut").reason).toBe("Can't cut bar 2 automatically — edit it in the source");
    expect(find(groups, "copy").reason).toBe("Can't copy bar 2 automatically — copy it from the source");
    expect(find(groups, "paste").reason).toBe("Can't paste into bar 2 automatically — edit it in the source");
    expect(find(groups, "pasteInsert")).toMatchObject({ enabled: false, reason: "Can't paste into bar 2 automatically — edit it in the source" });
    expect(find(groups, "duplicate").reason).toBe("Can't duplicate bar 2 automatically — edit it in the source");
    for (const id of ["deleteBeat", "deleteBar", "insertBeat"]) expect(find(groups, id).enabled, id).toBe(true);
  });

  it("on a tie whose note hides behind a beat the editor cannot read, Tie is disabled, naming the caret's bar", () => {
    // The first bar's dead note, `x.5`, is a beat the editor cannot read, between the 3 on string 6 and the tie
    // that opens the second bar: untying would have to guess the fret. The second bar itself reads fine.
    const hidden = menu("3.6.4 x.5 7.5 8.5 | -.6.4 5.6 7.6 8.6", at(1, 0));
    expect(find(hidden, "tie")).toMatchObject({ enabled: false, pressed: true, reason: refusedNotice(1, "change") });
    // The same tie over beats it can read unties.
    const readable = menu("3.6.4 5.5 7.5 8.5 | -.6.4 5.6 7.6 8.6", at(1, 0));
    expect(find(readable, "tie")).toMatchObject({ enabled: true, pressed: true });
    // Only an untie needs the fret: a note there, tied over the unreadable beat, is allowed (as toggleTie allows it).
    const note = menu("3.6.4 x.5 7.5 8.5 | 5.6.4 5.6 7.6 8.6", at(1, 0));
    expect(find(note, "tie")).toMatchObject({ enabled: true, pressed: false });
  });

  it("a tie with nothing earlier on its string can still be taken out: Tie is enabled, and pressed", () => {
    expect(find(menu("-.6.4 5.6 7.6 8.6", at(0, 0)), "tie")).toMatchObject({ enabled: true, pressed: true });
  });

  it("disables everything while the tab does not parse", () => {
    const groups = menu("3.6.4 (((", at(0, 0));
    expect(items(groups).length).toBeGreaterThan(20);
    for (const i of items(groups)) expect(i, i.id).toMatchObject({ enabled: false, reason: PARSE_REASON });
  });

  it("Paste is enabled on a parsed, editable bar whatever the clipboard holds; Nothing to paste only with no clipboard and no copy", () => {
    for (const clipboard of [SECURE, { secure: false, hasFallbackClip: true }, { secure: true, hasFallbackClip: true }]) {
      expect(find(menu(BODY, at(0, 0), { clipboard }), "paste").enabled, JSON.stringify(clipboard)).toBe(true);
    }
    const none = menu(BODY, at(0, 0), { clipboard: { secure: false, hasFallbackClip: false } });
    expect(find(none, "paste")).toMatchObject({ enabled: false, reason: NOTHING_TO_PASTE });
    expect(find(none, "pasteInsert")).toMatchObject({ enabled: false, reason: NOTHING_TO_PASTE });
  });

  it("names the toggles' state for aria, and the keys for aria-keyshortcuts", () => {
    const groups = menu(BODY, at(0, 0));
    expect(find(groups, "hammer")).toMatchObject({ pressed: true, ariaKeys: "h" });
    expect(find(groups, "longer").ariaKeys).toBe("Plus");
    expect(find(groups, "pasteInsert").ariaKeys).toBe("Control+Shift+V");
    expect(find(groups, "copy").pressed).toBeUndefined();
  });
});

describe("menuItems: the selection menu", () => {
  const selection: Range = { from: { barIndex: 0, beatIndex: 0 }, to: { barIndex: 0, beatIndex: 2 } };
  const groups = menu(BODY, at(0, 2), { selection });

  it("shows only what acts on a selection", () => {
    expect(groups.map((g) => [g.label, g.items.map((i) => (i.keyHint ? `${i.label} (${i.keyHint})` : i.label))])).toEqual([
      [
        "Edit",
        ["Clear (Delete)", "Remove (Shift+Delete)", "Cut (Ctrl+X)", "Copy (Ctrl+C)", "Paste (Ctrl+V)",
          "Paste in front (Ctrl+Shift+V)", "Duplicate (d)"],
      ],
      ["Selection", ["Clear selection"]],
    ]);
    expect(items(groups).every((i) => i.enabled)).toBe(true);
  });

  it("checks the selection's first bar", () => {
    const tex = doc('3.6.4 5.6{ch "Am"} 7.6 8.6 | 3.6.4 5.6 7.6 8.6');
    const unreadable = menuItems({ tex, parsed: parseTex(tex), caret: at(1, 1), selection: { from: { barIndex: 0, beatIndex: 1 }, to: { barIndex: 1, beatIndex: 1 } }, clipboard: SECURE });
    expect(find(unreadable, "cut").reason).toBe("Can't cut bar 1 automatically — edit it in the source");
    expect(find(unreadable, "copy").reason).toBe("Can't copy bar 1 automatically — copy it from the source");
    expect(find(unreadable, "clear").reason).toBe("Can't clear bar 1 automatically — edit it in the source");
    expect(find(unreadable, "paste")).toMatchObject({ enabled: false, reason: "Can't paste into bar 1 automatically — edit it in the source" });
    expect(find(unreadable, "pasteInsert")).toMatchObject({ enabled: false, reason: "Can't paste into bar 1 automatically — edit it in the source" });
    expect(find(unreadable, "duplicate")).toMatchObject({ enabled: false, reason: "Can't duplicate bar 1 automatically — edit it in the source" });
    expect(find(unreadable, "remove").enabled).toBe(true);
    expect(find(unreadable, "clearSelection").enabled).toBe(true);
  });

  it("disables everything while the tab does not parse — Remove and Clear selection too", () => {
    const tex = doc("3.6.4 (((");
    const broken = menuItems({ tex, parsed: parseTex(tex), caret: at(0, 2), selection, clipboard: SECURE });
    expect(items(broken).map((i) => i.id)).toEqual(["clear", "remove", "cut", "copy", "paste", "pasteInsert", "duplicate", "clearSelection"]);
    for (const i of items(broken)) expect(i, i.id).toMatchObject({ enabled: false, reason: PARSE_REASON });
  });
});

// The keys a menu item shows must run what the item runs: each hint, read back as a keydown the way
// tabEditorShortcuts.test.ts reads the ? help, resolves through matchChord to the item's command — or,
// for the clipboard, to nothing in the keymap and the item's action in clipboardChord. Only the three
// bends without a letter and Clear selection (whose Escape closes the menu first) have none.
describe("menuItems: the key hints do not drift from the keymap", () => {
  const MODIFIERS = new Set(["Ctrl", "Cmd", "Shift", "Alt"]);
  const IMPLIES_SHIFT = new Set(["+", "?"]);
  const toEvent = (printed: string): ChordEvent => {
    const keys = printed.split(/\+(?!$)/);
    const mods = keys.filter((k) => MODIFIERS.has(k));
    const key = keys.find((k) => !MODIFIERS.has(k))!;
    return {
      key,
      ctrlKey: mods.includes("Ctrl") || mods.includes("Cmd"),
      metaKey: false,
      shiftKey: mods.includes("Shift") || IMPLIES_SHIFT.has(key),
      altKey: mods.includes("Alt"),
    };
  };
  const every = [
    ...items(menu(BODY, at(0, 0))),
    ...items(menu("3.6.4 5.6 7.6", at(0, 0))),
    ...items(menu(BODY, at(0, 2), { selection: { from: { barIndex: 0, beatIndex: 0 }, to: { barIndex: 0, beatIndex: 2 } } })),
  ];

  it.each(every.filter((i) => i.keyHint).map((i) => [`${i.id} (${i.keyHint})`, i] as const))("%s", (_name, i) => {
    const keydown = toEvent(i.keyHint!);
    if (i.action.kind === "command") {
      expect(matchChord(keydown)).toEqual(i.action.command);
    } else {
      expect(matchChord(keydown)).toBeNull();
      expect(clipboardChord(keydown)).toBe(i.action.action);
    }
  });

  it("leaves only the three letterless bends and Clear selection without a key", () => {
    expect([...new Set(every.filter((i) => !i.keyHint).map((i) => i.id))]).toEqual(["bendHalf", "bendRelease", "preBend", "clearSelection"]);
  });
});

describe("menuStep: the arrow keys in the menu", () => {
  // Three groups: items 0-1, 2-4, 5.
  const SIZES = [2, 3, 1];

  it("Down and Up move one item, across groups, wrapping round", () => {
    expect(menuStep(SIZES, 1, "ArrowDown")).toBe(2);
    expect(menuStep(SIZES, 5, "ArrowDown")).toBe(0);
    expect(menuStep(SIZES, 2, "ArrowUp")).toBe(1);
    expect(menuStep(SIZES, 0, "ArrowUp")).toBe(5);
  });

  it("Home and End go to the first and last item", () => {
    expect(menuStep(SIZES, 3, "Home")).toBe(0);
    expect(menuStep(SIZES, 3, "End")).toBe(5);
  });

  it("Right and Left go to the first item of the next and previous group, wrapping round", () => {
    expect(menuStep(SIZES, 0, "ArrowRight")).toBe(2);
    expect(menuStep(SIZES, 3, "ArrowRight")).toBe(5);
    expect(menuStep(SIZES, 5, "ArrowRight")).toBe(0);
    expect(menuStep(SIZES, 3, "ArrowLeft")).toBe(0);
    expect(menuStep(SIZES, 0, "ArrowLeft")).toBe(5);
  });

  it("from no item, starts at an end; skips empty groups; any other key is not a move", () => {
    expect(menuStep(SIZES, -1, "ArrowDown")).toBe(0);
    expect(menuStep(SIZES, -1, "ArrowUp")).toBe(5);
    expect(menuStep(SIZES, -1, "ArrowRight")).toBe(0);
    // Left goes to the last group's first item, not the last item: items 5-6 here.
    expect(menuStep([2, 3, 2], -1, "ArrowLeft")).toBe(5);
    expect(menuStep([2, 3, 2], -1, "End")).toBe(6);
    expect(menuStep([2, 0, 3], 1, "ArrowRight")).toBe(2);
    expect(menuStep(SIZES, 2, "Enter")).toBeNull();
    expect(menuStep([], 0, "ArrowDown")).toBeNull();
  });
});

describe("menuStaysOpen: what closes the menu and what keeps it open", () => {
  const here = at(0, 1, 3);

  it("keeps it open across edits at the caret", () => {
    for (const kind of ["setFret", "clearNote", "makeRest", "scaleDuration", "toggleDotted", "toggleTuplet", "toggleTechnique", "toggleTie"] as const) {
      expect(menuStaysOpen(kind, "note", here, { ...here }, false), kind).toBe(true);
    }
  });

  it("closes it after a command that moved the caret, by value — and not after one that could not move it", () => {
    expect(menuStaysOpen("moveBeat", "note", here, at(0, 2, 3), false)).toBe(false);
    expect(menuStaysOpen("moveString", "note", here, at(0, 1, 2), false)).toBe(false);
    expect(menuStaysOpen("moveBeat", "note", at(0, 0, 3), at(0, 0, 3), false)).toBe(true);
  });

  it("closes it after a command that changes the layout or goes elsewhere, whatever it did", () => {
    for (const kind of ["insertBeat", "deleteBeat", "addBar", "deleteBar", "fixBar", "duplicate", "selectAll", "clearSelection", "playPause", "undo", "redo", "showHelp"] as const) {
      expect(menuStaysOpen(kind, "note", here, here, false), kind).toBe(false);
    }
  });

  it("never closes it on openMenu, which moves focus into a menu opened with the mouse", () => {
    expect(menuStaysOpen("openMenu", "note", here, { ...here }, false)).toBe(true);
    expect(menuStaysOpen("openMenu", "selection", here, { ...here }, true)).toBe(true);
  });

  it("closes the selection menu when the selection goes — a fret typed over it clears it first — and the note menu when one comes", () => {
    expect(menuStaysOpen("setFret", "selection", here, here, false)).toBe(false);
    expect(menuStaysOpen("clearNote", "selection", here, here, true)).toBe(true);
    expect(menuStaysOpen("extendSelection", "note", here, here, true)).toBe(false);
  });
});
