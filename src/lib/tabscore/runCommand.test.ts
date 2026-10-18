import { describe, it, expect } from "vitest";
import {
  BAR_NOTICE_MS, copyText, cutText, pasteText, readForPaste, runCommand, type CommandDeps, type DigitBuffer,
} from "./runCommand";
import { parseTex } from "./parse";
import type { BeatPos, Caret } from "./locate";
import type { CommandResult } from "./apply";
import { previewAction, type PreviewAction } from "./notePreview";
import type { ChordCommand } from "./keymap";
import { extendByBeat, extendToBarEdge, rangeOf } from "./selection";
import { setFret, clearNote } from "./commands/setFret";
import { scaleDuration, toggleDotted } from "./commands/duration";
import { addBar, deleteBar, deleteBeat, extendScore, insertBeat } from "./commands/structure";
import { toggleTechnique } from "./commands/technique";
import { toggleTie } from "./commands/tie";
import { toggleTuplet, TRIPLET } from "./commands/tuplet";
import { fixBar } from "./commands/fixBar";
import { clearRange, removeRange } from "./commands/rangeEdit";
import { duplicate } from "./commands/duplicate";
import { moveBeat, moveString } from "./commands/navigate";
import { ALREADY_REST_NOTICE, refusedNotice } from "./barMessages";
import { NOT_A_PASSAGE_NOTICE } from "./clipMessages";
import { NOTHING_TO_TIE_NOTICE, PARSE_ERROR_NOTICE, pastedFromEditorNotice } from "./menuMessages";

const doc = (body: string) => `\\tempo 120\n.\n${body}\n`;
// Bar 1 adds up; bar 2 holds a tie and a rest; bar 3 is a beat short.
const TEX = doc("3.6.4 5.6 7.6 8.6 | 3.6.4 -.6 r 5.5 | 3.6.4 5.6 7.6");
const at = (barIndex: number, beatIndex: number, string = 6): Caret => ({ barIndex, beatIndex, string });

/** An editor in memory, as TabEditor's refs and callbacks are: what runCommand sees and does. */
function editor(text: string, caret: Caret, anchor: BeatPos | null = null) {
  const state = {
    text,
    caret,
    anchor,
    digits: null as DigitBuffer | null,
    clock: 10_000,
    notices: [] as Array<{ message: string; ms?: number }>,
    previews: [] as PreviewAction[],
    calls: [] as string[],
  };
  const deps: CommandDeps = {
    text: () => state.text,
    caret: () => state.caret,
    anchor: () => state.anchor,
    parsedOk: () => parseTex(state.text).ok,
    digits: () => state.digits,
    setDigits: (buffer) => {
      state.digits = buffer;
    },
    now: () => state.clock,
    commit: (next, nextCaret, nextAnchor = null) => {
      state.text = next;
      if (nextCaret) state.caret = nextCaret;
      state.anchor = nextAnchor;
    },
    moveCaret: (next) => {
      state.digits = null;
      state.caret = next;
    },
    setAnchor: (next) => {
      state.anchor = next;
    },
    notice: (message, ms) => state.notices.push(ms === undefined ? { message } : { message, ms }),
    preview: (prev, next, source) => state.previews.push(previewAction(prev, next, source)),
    undo: () => state.calls.push("undo"),
    redo: () => state.calls.push("redo"),
    playPause: () => state.calls.push("playPause"),
    toggleHelp: () => state.calls.push("toggleHelp"),
    openMenu: () => state.calls.push("openMenu"),
  };
  return { state, deps };
}

/** What a command left: the document, the caret, the selection, the notices, the preview, what it asked of the editor. */
type Outcome = ReturnType<typeof after>;
const after = (e: ReturnType<typeof editor>) => ({
  text: e.state.text,
  caret: e.state.caret,
  anchor: e.state.anchor,
  notices: e.state.notices,
  previews: e.state.previews,
  calls: e.state.calls,
});
/** The same, for an edit made by a command function, as TabEditor's inline dispatch committed it. */
const edited = (result: CommandResult | null, caret: Caret, notices: Outcome["notices"] = []): Outcome => ({
  text: result ? result.text : TEX,
  caret: result ? result.caret : caret,
  anchor: null,
  notices,
  previews: [result ? "request" : "none"],
  calls: [],
});

interface Case {
  command: ChordCommand;
  caret: Caret;
  anchor?: BeatPos | null;
  want: () => Outcome;
}

// One case per kind, against what TabEditor's own dispatch did with the same key before it moved here:
// the command function it called, the notice it showed, the preview it asked for. A mapped type, so a
// kind added to keymap.ts is a compile error here until it has a case.
const CASES: { [K in ChordCommand["kind"]]: Case } = {
  setFret: { command: { kind: "setFret", digit: 7 }, caret: at(0, 1), want: () => edited(setFret(TEX, at(0, 1), 7), at(0, 1)) },
  moveBeat: {
    command: { kind: "moveBeat", delta: 1 },
    caret: at(0, 1),
    want: () => ({ ...edited(null, at(0, 1)), caret: moveBeat(TEX, at(0, 1), 1), previews: ["request"] }),
  },
  moveString: {
    command: { kind: "moveString", delta: -1 },
    caret: at(0, 1),
    want: () => ({ ...edited(null, at(0, 1)), caret: moveString(at(0, 1), -1), previews: ["none"] }),
  },
  clearNote: { command: { kind: "clearNote" }, caret: at(0, 1), want: () => edited(clearNote(TEX, at(0, 1)), at(0, 1)) },
  insertBeat: { command: { kind: "insertBeat" }, caret: at(0, 1), want: () => edited(insertBeat(TEX, at(0, 1)), at(0, 1)) },
  deleteBeat: { command: { kind: "deleteBeat" }, caret: at(0, 1), want: () => edited(deleteBeat(TEX, at(0, 1)), at(0, 1)) },
  addBar: { command: { kind: "addBar" }, caret: at(0, 1), want: () => edited(addBar(TEX, at(0, 1)), at(0, 1)) },
  deleteBar: { command: { kind: "deleteBar" }, caret: at(0, 1), want: () => edited(deleteBar(TEX, at(0, 1)), at(0, 1)) },
  scaleDuration: {
    command: { kind: "scaleDuration", direction: "halve" },
    caret: at(0, 1),
    want: () => edited(scaleDuration(TEX, at(0, 1), "halve"), at(0, 1)),
  },
  toggleDotted: { command: { kind: "toggleDotted" }, caret: at(0, 1), want: () => edited(toggleDotted(TEX, at(0, 1)), at(0, 1)) },
  toggleTechnique: {
    command: { kind: "toggleTechnique", technique: "bendHalf" },
    caret: at(0, 1),
    want: () => edited(toggleTechnique(TEX, at(0, 1), "bendHalf"), at(0, 1)),
  },
  toggleTie: { command: { kind: "toggleTie" }, caret: at(0, 1), want: () => edited(toggleTie(TEX, at(0, 1)), at(0, 1)) },
  toggleTuplet: { command: { kind: "toggleTuplet" }, caret: at(0, 1), want: () => edited(toggleTuplet(TEX, at(0, 1), TRIPLET), at(0, 1)) },
  makeRest: {
    command: { kind: "makeRest" },
    caret: at(1, 2),
    want: () => ({ ...edited(null, at(1, 2), [{ message: ALREADY_REST_NOTICE, ms: BAR_NOTICE_MS }]) }),
  },
  fixBar: {
    command: { kind: "fixBar" },
    caret: at(2, 0),
    want: () => {
      const outcome = fixBar(TEX, at(2, 0));
      if (outcome.kind !== "ok") throw new Error("fixture: bar 3 should be fixable");
      return edited(outcome.result, at(2, 0), [{ message: "Added 1 rest to bar 3 — Ctrl+Z to undo", ms: BAR_NOTICE_MS }]);
    },
  },
  extendSelection: {
    command: { kind: "extendSelection", delta: 1 },
    caret: at(0, 1),
    want: () => ({
      ...edited(null, at(0, 1)),
      caret: extendByBeat(parseTex(TEX).scoreNode, at(0, 1), 1),
      anchor: { barIndex: 0, beatIndex: 1 },
      previews: ["request"],
    }),
  },
  extendSelectionToBar: {
    command: { kind: "extendSelectionToBar", delta: 1 },
    caret: at(0, 1),
    want: () => ({
      ...edited(null, at(0, 1)),
      caret: extendToBarEdge(parseTex(TEX).scoreNode, at(0, 1), 1),
      anchor: { barIndex: 0, beatIndex: 1 },
      previews: ["request"],
    }),
  },
  selectAll: {
    command: { kind: "selectAll" },
    caret: at(1, 1),
    want: () => ({ ...edited(null, at(1, 1)), caret: at(2, 2), anchor: { barIndex: 0, beatIndex: 0 }, previews: [] }),
  },
  clearSelection: {
    command: { kind: "clearSelection" },
    caret: at(0, 2),
    anchor: { barIndex: 0, beatIndex: 0 },
    want: () => ({ ...edited(null, at(0, 2)), previews: [] }),
  },
  duplicate: {
    command: { kind: "duplicate" },
    caret: at(0, 1),
    want: () => {
      const outcome = duplicate(TEX, at(0, 1), null);
      if (outcome.kind !== "ok") throw new Error("fixture: bar 1 should duplicate");
      return {
        ...edited(outcome.result, at(0, 1), [{ message: "Duplicated bar 1", ms: BAR_NOTICE_MS }]),
        anchor: outcome.selection?.to ?? null,
      };
    },
  },
  playPause: { command: { kind: "playPause" }, caret: at(0, 1), want: () => ({ ...edited(null, at(0, 1)), previews: ["cancel"], calls: ["playPause"] }) },
  undo: { command: { kind: "undo" }, caret: at(0, 1), want: () => ({ ...edited(null, at(0, 1)), previews: [], calls: ["undo"] }) },
  redo: { command: { kind: "redo" }, caret: at(0, 1), want: () => ({ ...edited(null, at(0, 1)), previews: [], calls: ["redo"] }) },
  showHelp: { command: { kind: "showHelp" }, caret: at(0, 1), want: () => ({ ...edited(null, at(0, 1)), previews: [], calls: ["toggleHelp"] }) },
  openMenu: { command: { kind: "openMenu" }, caret: at(0, 1), want: () => ({ ...edited(null, at(0, 1)), previews: [], calls: ["openMenu"] }) },
};

describe("runCommand: every kind does what its key did", () => {
  it.each(Object.entries(CASES))("%s", (_kind, c) => {
    const e = editor(TEX, c.caret, c.anchor ?? null);
    runCommand(c.command, e.deps);
    expect(after(e)).toEqual(c.want());
  });
});

describe("runCommand: the rules around the dispatch", () => {
  const SELECTED = { barIndex: 0, beatIndex: 0 };

  it("a command that does not act on the selection clears it first, even when it then does nothing", () => {
    const e = editor(TEX, at(0, 0, 1), SELECTED);
    runCommand({ kind: "toggleTechnique", technique: "hammer" }, e.deps); // no note on string 1: nothing to toggle
    expect(e.state.anchor).toBeNull();
    expect(e.state.text).toBe(TEX);
  });

  it("Delete and Shift+Delete act on the whole selection — so does the − Beat button, which runs deleteBeat", () => {
    const cleared = editor(TEX, at(0, 2), SELECTED);
    runCommand({ kind: "clearNote" }, cleared.deps);
    const wantCleared = clearRange(TEX, at(0, 2), rangeOf(SELECTED, at(0, 2)));
    expect(wantCleared.kind).toBe("ok");
    expect(cleared.state.text).toBe(wantCleared.kind === "ok" ? wantCleared.result.text : "");
    expect(cleared.state.anchor).toEqual(SELECTED);

    const removed = editor(TEX, at(0, 2), SELECTED);
    runCommand({ kind: "deleteBeat" }, removed.deps);
    const wantRemoved = removeRange(TEX, at(0, 2), rangeOf(SELECTED, at(0, 2)));
    expect(removed.state.text).toBe(wantRemoved.kind === "ok" ? wantRemoved.result.text : "");
    expect(removed.state.anchor).toBeNull();
  });

  it("openMenu keeps the selection, and runs while the tab does not parse — as undo, redo, play and help do", () => {
    const broken = doc("3.6.4 (((");
    for (const kind of ["openMenu", "undo", "redo", "playPause", "showHelp"] as const) {
      const e = editor(broken, at(0, 0), kind === "openMenu" ? SELECTED : null);
      runCommand({ kind }, e.deps);
      expect(e.state.notices, kind).toEqual([]);
      expect(e.state.calls.length, kind).toBe(1);
    }
    const kept = editor(TEX, at(0, 2), SELECTED);
    runCommand({ kind: "openMenu" }, kept.deps);
    expect(kept.state.anchor).toEqual(SELECTED);
  });

  it("opening the menu drops a half-typed fret: the next digit is a fret of its own", () => {
    const e = editor(TEX, at(0, 1));
    runCommand({ kind: "setFret", digit: 1 }, e.deps);
    runCommand({ kind: "openMenu" }, e.deps); // the clock stands still: the 2 is well inside the window
    runCommand({ kind: "setFret", digit: 2 }, e.deps);
    expect(e.state.text).toBe(setFret(TEX, at(0, 1), 2)!.text);
  });

  it("any key but a digit drops a half-typed fret, whether or not the tab parses", () => {
    // Undo and redo drop it in TabEditor's own undo and redo, which this editor only records.
    for (const [kind, c] of Object.entries(CASES)) {
      if (["setFret", "undo", "redo"].includes(kind)) continue;
      const e = editor(TEX, c.caret, c.anchor ?? null);
      e.state.digits = { digits: "1", at: e.state.clock };
      runCommand(c.command, e.deps);
      expect(e.state.digits, kind).toBeNull();
    }
    // → on the last beat grows the score — an edit, not a caret move — and drops it too.
    const grown = editor(TEX, at(2, 2));
    grown.state.digits = { digits: "7", at: grown.state.clock };
    runCommand({ kind: "moveBeat", delta: 1 }, grown.deps);
    expect(grown.state.digits).toBeNull();

    const broken = doc("3.6.4 (((");
    for (const [kind, c] of Object.entries(CASES)) {
      if (["undo", "redo"].includes(kind)) continue;
      const e = editor(broken, at(0, 0));
      e.state.digits = { digits: "1", at: e.state.clock };
      runCommand(c.command, e.deps);
      expect(e.state.digits, `${kind}, not parsing`).toBeNull();
    }
  });

  it("Shift+→ over a selection moves its head and keeps its anchor", () => {
    const e = editor(TEX, at(0, 1), SELECTED);
    runCommand({ kind: "extendSelection", delta: 1 }, e.deps);
    expect(e.state.anchor).toEqual(SELECTED);
    expect(e.state.caret).toEqual(at(0, 2));
  });

  it("every other command says the tab does not parse and changes nothing", () => {
    const broken = doc("3.6.4 (((");
    for (const [kind, c] of Object.entries(CASES)) {
      if (["openMenu", "undo", "redo", "playPause", "showHelp"].includes(kind)) continue;
      const e = editor(broken, at(0, 0));
      runCommand(c.command, e.deps);
      expect(e.state.text, kind).toBe(broken);
      expect(e.state.notices, kind).toEqual([{ message: PARSE_ERROR_NOTICE }]);
    }
  });

  it("composes two digits typed within 800 ms on one caret into one fret, and not after", () => {
    const fast = editor(TEX, at(0, 1));
    runCommand({ kind: "setFret", digit: 1 }, fast.deps);
    fast.state.clock += 500;
    runCommand({ kind: "setFret", digit: 2 }, fast.deps);
    expect(fast.state.text).toBe(setFret(TEX, at(0, 1), 12)!.text);

    const slow = editor(TEX, at(0, 1));
    runCommand({ kind: "setFret", digit: 1 }, slow.deps);
    slow.state.clock += 900;
    runCommand({ kind: "setFret", digit: 2 }, slow.deps);
    expect(slow.state.text).toBe(setFret(TEX, at(0, 1), 2)!.text);
  });

  it("the window's edge: a second digit 800 ms after the first still composes, 801 ms after it does not", () => {
    const edge = editor(TEX, at(0, 1));
    runCommand({ kind: "setFret", digit: 1 }, edge.deps);
    edge.state.clock += 800;
    runCommand({ kind: "setFret", digit: 2 }, edge.deps);
    expect(edge.state.text).toBe(setFret(TEX, at(0, 1), 12)!.text);

    const past = editor(TEX, at(0, 1));
    runCommand({ kind: "setFret", digit: 1 }, past.deps);
    past.state.clock += 801;
    runCommand({ kind: "setFret", digit: 2 }, past.deps);
    expect(past.state.text).toBe(setFret(TEX, at(0, 1), 2)!.text);
  });

  it("→ on the last beat grows the score", () => {
    const e = editor(TEX, at(2, 2));
    runCommand({ kind: "moveBeat", delta: 1 }, e.deps);
    expect(e.state.text).toBe(extendScore(TEX, at(2, 2))!.text);
    expect(e.state.previews).toEqual(["request"]);
  });

  it("Tie says why it refused — nothing earlier on the string, or a beat it cannot read — from the toolbar as from the key", () => {
    const nothing = editor(TEX, at(0, 0));
    runCommand({ kind: "toggleTie" }, nothing.deps);
    expect(nothing.state.notices).toEqual([{ message: NOTHING_TO_TIE_NOTICE }]);

    // Untying the tie in bar 1 would have to name the fret before it, which a beat it cannot read hides.
    const blocked = doc("x.6.4 -.6 r r");
    const refused = editor(blocked, at(0, 1));
    runCommand({ kind: "toggleTie" }, refused.deps);
    expect(refused.state.notices).toEqual([{ message: refusedNotice(0, "change"), ms: BAR_NOTICE_MS }]);
  });

  it("`.` says why it refused, in a bar it cannot read — on a whole note and on a 64th, where `+` and `-` would have nothing to do", () => {
    // `.` asks about a dot, not a step: a whole note cannot be doubled nor a 64th halved, and those
    // limits are quiet, but a dot on either is refused here only because of the chord name.
    for (const body of ['3.6.1{ch "Am"}', '3.6.64{ch "Am"} r.64']) {
      const e = editor(doc(body), at(0, 0));
      runCommand({ kind: "toggleDotted" }, e.deps);
      expect(e.state.text, body).toBe(doc(body));
      expect(e.state.notices, body).toEqual([{ message: refusedNotice(0, "change"), ms: BAR_NOTICE_MS }]);
    }
  });

  it("Shift+Delete over whole bars says it could not remove the bar, not beats from it", () => {
    // Bar 2 cannot go: closing the gap walks back along every string for a hammer-on or slide to drop,
    // and on string 6 the walk stops at bar 1's dead note, a beat the commands cannot read.
    const body = "x.6.4 r r r | 5.6.4 r r r | 3.6.4 r r r";
    const e = editor(doc(body), at(1, 3), { barIndex: 1, beatIndex: 0 });
    runCommand({ kind: "deleteBeat" }, e.deps);
    expect(e.state.text).toBe(doc(body));
    expect(e.state.notices).toEqual([{ message: "Can't remove bar 2 automatically — edit it in the source", ms: BAR_NOTICE_MS }]);
    expect(e.state.anchor).toEqual({ barIndex: 1, beatIndex: 0 });
  });
});

describe("copyText, cutText and pasteText", () => {
  it("copy gives the clip's text and says what it copied; the document stays", () => {
    const e = editor(TEX, at(0, 1), { barIndex: 0, beatIndex: 0 });
    expect(copyText(e.deps)).toBe("3.6.4 5.6");
    expect(e.state.text).toBe(TEX);
    expect(e.state.notices).toEqual([{ message: "Copied 2 beats", ms: BAR_NOTICE_MS }]);
  });

  it("cut gives the clip's text and leaves rests, keeping the selection", () => {
    const e = editor(TEX, at(0, 1), { barIndex: 0, beatIndex: 0 });
    expect(cutText(e.deps)).toBe("3.6.4 5.6");
    expect(e.state.text).toBe(doc("r.4 r 7.6 8.6 | 3.6.4 -.6 r 5.5 | 3.6.4 5.6 7.6"));
    expect(e.state.anchor).toEqual({ barIndex: 0, beatIndex: 0 });
    expect(e.state.notices).toEqual([{ message: "Cut 2 beats", ms: BAR_NOTICE_MS }]);
  });

  it("copy and cut give nothing, and change nothing, while the tab does not parse", () => {
    const broken = doc("3.6.4 (((");
    for (const run of [copyText, cutText]) {
      const e = editor(broken, at(0, 0));
      expect(run(e.deps)).toBeNull();
      expect(e.state.notices).toEqual([{ message: PARSE_ERROR_NOTICE }]);
    }
  });

  it("paste, too, changes nothing while the tab does not parse, and says so", () => {
    const broken = doc("3.6.4 (((");
    const e = editor(broken, at(0, 0));
    pasteText(e.deps, "9.6.4", false);
    expect(e.state.text).toBe(broken);
    expect(e.state.notices).toEqual([{ message: PARSE_ERROR_NOTICE }]);
  });

  it("copy, cut and paste drop a half-typed fret", () => {
    for (const act of [copyText, cutText, (deps: CommandDeps) => pasteText(deps, "9.6.4", false)]) {
      const e = editor(TEX, at(0, 1));
      e.state.digits = { digits: "1", at: e.state.clock };
      act(e.deps);
      expect(e.state.digits).toBeNull();
    }
  });

  it("paste writes over the music at the caret and selects it; in front with inserts", () => {
    const over = editor(TEX, at(0, 2));
    pasteText(over.deps, "9.6.4", false);
    expect(over.state.text).toBe(doc("3.6.4 5.6 9.6.4 8.6 | 3.6.4 -.6 r 5.5 | 3.6.4 5.6 7.6"));
    expect(over.state.notices).toEqual([{ message: "Pasted 1 beat", ms: BAR_NOTICE_MS }]);

    const front = editor(TEX, at(0, 2));
    pasteText(front.deps, "9.6.4", true, pastedFromEditorNotice);
    expect(front.state.text).toBe(doc("3.6.4 5.6 9.6.4 7.6 8.6 | 3.6.4 -.6 r 5.5 | 3.6.4 5.6 7.6"));
    expect(front.state.notices).toEqual([
      { message: "Pasted 1 beat copied in the editor — the browser didn't share its clipboard", ms: BAR_NOTICE_MS },
    ]);
  });

  it("paste over a selection lands on its first beat, though the caret is at its other end", () => {
    const e = editor(TEX, at(0, 3, 4), { barIndex: 0, beatIndex: 1 });
    pasteText(e.deps, "9.6.4 10.6", false);
    expect(e.state.text).toBe(doc("3.6.4 9.6.4 10.6 8.6 | 3.6.4 -.6 r 5.5 | 3.6.4 5.6 7.6"));
    // The pasted beats are selected, caret on the first of them, on the string it was on.
    expect(e.state.caret).toEqual(at(0, 1, 4));
    expect(e.state.anchor).toEqual({ barIndex: 0, beatIndex: 2 });
  });

  it("text that is not a passage is said so, and changes nothing", () => {
    const e = editor(TEX, at(0, 2));
    pasteText(e.deps, "hello", false);
    expect(e.state.text).toBe(TEX);
    expect(e.state.notices).toEqual([{ message: NOT_A_PASSAGE_NOTICE, ms: BAR_NOTICE_MS }]);
  });

  it("asks no preview of a copy, and one of a cut or a paste only when it changed the music", () => {
    const copied = editor(TEX, at(0, 1), { barIndex: 0, beatIndex: 0 });
    copyText(copied.deps);
    expect(copied.state.previews).toEqual(["none"]);

    const cut = editor(TEX, at(0, 1), { barIndex: 0, beatIndex: 0 });
    cutText(cut.deps);
    expect(cut.state.previews).toEqual(["request"]);

    // A rest cut is copied and left as it was: nothing changed, nothing to hear.
    const rest = editor(TEX, at(1, 2));
    expect(cutText(rest.deps)).not.toBeNull();
    expect(rest.state.text).toBe(TEX);
    expect(rest.state.previews).toEqual(["none"]);

    const pasted = editor(TEX, at(0, 2));
    pasteText(pasted.deps, "9.6.4", false);
    expect(pasted.state.previews).toEqual(["request"]);

    // Beats across a bar line paste only in front, at a bar's first beat: refused here.
    const refused = editor(TEX, at(0, 2));
    pasteText(refused.deps, "3.6.4 | 5.6.4", false);
    expect(refused.state.text).toBe(TEX);
    expect(refused.state.previews).toEqual(["none"]);

    // Text that is not a passage never reaches a command, nor the preview.
    const notTab = editor(TEX, at(0, 2));
    pasteText(notTab.deps, "hello", false);
    expect(notTab.state.previews).toEqual([]);
  });
});

describe("readForPaste: where the menu's Paste finds its passage", () => {
  const reads = (text: string) => async () => text;
  const refuses = async (): Promise<string> => {
    throw new Error("NotAllowedError");
  };

  it("the editor's own clip, unread, when it is newer than the system clipboard", async () => {
    let asked = false;
    const readText = async () => {
      asked = true;
      return "1.6.4";
    };
    expect(await readForPaste({ readText, editorClip: "3.6.4", editorClipNewer: true })).toEqual({ raw: "3.6.4", blocked: false });
    expect(asked).toBe(false);
  });

  it("the system clipboard when it can be read and holds something", async () => {
    expect(await readForPaste({ readText: reads("1.6.4"), editorClip: "3.6.4", editorClipNewer: false })).toEqual({
      raw: "1.6.4",
      blocked: false,
    });
  });

  it("else the editor's clip: blocked when the browser refused, not when the clipboard was empty or unreadable", async () => {
    expect(await readForPaste({ readText: refuses, editorClip: "3.6.4", editorClipNewer: false })).toEqual({ raw: "3.6.4", blocked: true });
    expect(await readForPaste({ readText: reads(""), editorClip: "3.6.4", editorClipNewer: false })).toEqual({ raw: "3.6.4", blocked: false });
    expect(await readForPaste({ editorClip: "3.6.4", editorClipNewer: false })).toEqual({ raw: "3.6.4", blocked: false });
  });

  it("nothing when there is neither", async () => {
    expect(await readForPaste({ readText: refuses, editorClip: null, editorClipNewer: false })).toBeNull();
    expect(await readForPaste({ readText: reads(""), editorClip: null, editorClipNewer: true })).toBeNull();
    expect(await readForPaste({ editorClip: null, editorClipNewer: false })).toBeNull();
  });
});
