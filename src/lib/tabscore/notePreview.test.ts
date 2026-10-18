import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { previewAction, createPreviewScheduler, type PreviewSource } from "./notePreview";
import type { ChordCommand } from "./keymap";
import type { Caret } from "./locate";

const at = (barIndex: number, beatIndex: number, string = 6): Caret => ({ barIndex, beatIndex, string });
const command = (kind: ChordCommand["kind"], accepted = true): PreviewSource => ({
  kind: "command",
  command: kind,
  accepted,
});

// Every ChordCommand kind, written out. If keymap.ts gains one, `npx tsc
// --noEmit` fails on `allKindsListed` until this list — and previewAction —
// say what it does to a preview.
const EDITS = [
  "setFret",
  "clearNote",
  "scaleDuration",
  "toggleDotted",
  "toggleTechnique",
  "toggleTie",
  "toggleTuplet",
  "makeRest",
  "fixBar",
  "duplicate",
  "insertBeat",
  "deleteBeat",
  "addBar",
  "deleteBar",
] as const satisfies readonly ChordCommand["kind"][];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const OTHERS = [
  "moveBeat",
  "moveString",
  "playPause",
  "undo",
  "redo",
  "showHelp",
  "extendSelection",
  "extendSelectionToBar",
  "selectAll",
  "clearSelection",
  "openMenu",
] as const satisfies readonly ChordCommand["kind"][];
type Unlisted = Exclude<ChordCommand["kind"], (typeof EDITS)[number] | (typeof OTHERS)[number]>;
const allKindsListed: [Unlisted] extends [never] ? true : false = true;

describe("previewAction", () => {
  it("lists every command kind", () => {
    expect(allKindsListed).toBe(true);
  });

  it.each(EDITS)("an accepted %s requests a preview", (kind) => {
    expect(previewAction(at(0, 1), at(0, 1), command(kind))).toBe("request");
  });

  it.each(EDITS)("a rejected %s leaves any pending preview alone", (kind) => {
    expect(previewAction(at(0, 1), at(0, 1), command(kind, false))).toBe("none");
  });

  it("a move to another beat requests", () => {
    expect(previewAction(at(0, 1), at(0, 2), command("moveBeat"))).toBe("request");
    expect(previewAction(at(0, 3), at(1, 0), command("moveBeat"))).toBe("request");
  });

  it("a move that stays on the same beat does not — compared by position, not identity", () => {
    expect(previewAction(at(0, 0), { ...at(0, 0) }, command("moveBeat"))).toBe("none");
  });

  it("a move to the same beat number in another bar requests — whole-note bars hold one beat each", () => {
    expect(previewAction(at(0, 0), at(1, 0), command("moveBeat"))).toBe("request");
  });

  it("↑/↓ within a beat does not", () => {
    expect(previewAction(at(0, 1, 6), at(0, 1, 5), command("moveString"))).toBe("none");
  });

  it("the help panel does not", () => {
    expect(previewAction(at(0, 1), at(0, 1), command("showHelp"))).toBe("none");
  });

  it.each(["playPause", "undo", "redo"] as const)("%s cancels", (kind) => {
    expect(previewAction(at(0, 1), at(0, 1), command(kind))).toBe("cancel");
  });

  it("the → that extends the score requests", () => {
    expect(previewAction(at(2, 0), at(3, 0), { kind: "extend" })).toBe("request");
  });

  it("a click requests, even on the beat the caret is already on", () => {
    expect(previewAction(at(0, 1), at(0, 1), { kind: "click", dragged: false })).toBe("request");
  });

  it("a press that became a drag does not", () => {
    expect(previewAction(at(0, 1), at(1, 2), { kind: "click", dragged: true })).toBe("none");
  });

  it("extending the selection requests when the caret lands on another beat, like a move", () => {
    expect(previewAction(at(0, 3), at(1, 0), command("extendSelection"))).toBe("request");
    expect(previewAction(at(0, 1), at(0, 3), command("extendSelectionToBar"))).toBe("request");
    expect(previewAction(at(2, 1), { ...at(2, 1) }, command("extendSelection"))).toBe("none");
  });

  it.each(["selectAll", "clearSelection", "openMenu"] as const)("%s does not", (kind) => {
    expect(previewAction(at(0, 0), at(3, 2), command(kind))).toBe("none");
  });

  it("a paste or a cut that acted requests; a copy, or one refused, does not", () => {
    expect(previewAction(at(0, 1), at(0, 1), { kind: "clipboard", action: "paste", accepted: true })).toBe("request");
    expect(previewAction(at(0, 1), at(0, 1), { kind: "clipboard", action: "cut", accepted: true })).toBe("request");
    expect(previewAction(at(0, 1), at(0, 1), { kind: "clipboard", action: "copy", accepted: true })).toBe("none");
    expect(previewAction(at(0, 1), at(0, 1), { kind: "clipboard", action: "paste", accepted: false })).toBe("none");
  });

  it("an excluded source cancels", () => {
    expect(previewAction(at(0, 1), at(0, 1), { kind: "excluded" })).toBe("cancel");
  });
});

describe("createPreviewScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const make = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onFire = vi.fn((_candidates: Caret[]) => {});
    return { onFire, scheduler: createPreviewScheduler({ delayMs: 150, onFire }) };
  };

  it("fires once, 150 ms after a request", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 1));
    vi.advanceTimersByTime(149);
    expect(onFire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith([at(0, 1)]);
  });

  it("restarts the wait on every request", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 1));
    vi.advanceTimersByTime(100);
    scheduler.request(at(0, 2));
    vi.advanceTimersByTime(100);
    expect(onFire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("hands over candidates newest first, so a fresh rest can fall back to the typed note", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 3)); // the fret just typed
    scheduler.request(at(1, 0)); // the rest → landed on
    vi.advanceTimersByTime(150);
    expect(onFire).toHaveBeenCalledWith([at(1, 0), at(0, 3)]);
  });

  it("merges a repeat of the same beat, keeping the latest caret", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 2, 6));
    scheduler.request(at(0, 2, 3));
    vi.advanceTimersByTime(150);
    expect(onFire).toHaveBeenCalledWith([at(0, 2, 3)]);
  });

  it("keeps the same beat number in two bars apart, newest first", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 0));
    scheduler.request(at(1, 0));
    vi.advanceTimersByTime(150);
    expect(onFire).toHaveBeenCalledWith([at(1, 0), at(0, 0)]);
  });

  it("merges only consecutive repeats: A, B, A is three candidates", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 1, 6)); // A
    scheduler.request(at(0, 2)); // B
    scheduler.request(at(0, 1, 3)); // A again, with another string so it is told apart from the first
    vi.advanceTimersByTime(150);
    expect(onFire).toHaveBeenCalledWith([at(0, 1, 3), at(0, 2), at(0, 1, 6)]);
  });

  it("keeps at most 8 candidates", () => {
    const { onFire, scheduler } = make();
    for (let i = 0; i < 12; i++) scheduler.request(at(0, i));
    vi.advanceTimersByTime(150);
    const candidates = onFire.mock.calls[0][0];
    expect(candidates).toHaveLength(8);
    expect(candidates[0]).toEqual(at(0, 11));
    expect(candidates[7]).toEqual(at(0, 4));
  });

  it("starts a fresh window after firing", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 1));
    vi.advanceTimersByTime(150);
    scheduler.request(at(0, 2));
    vi.advanceTimersByTime(150);
    expect(onFire).toHaveBeenNthCalledWith(2, [at(0, 2)]);
  });

  it("fires twice for a held arrow: the first step, then where it stops", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 1));
    vi.advanceTimersByTime(500); // the keyboard's repeat delay
    for (let i = 2; i < 12; i++) {
      scheduler.request(at(0, i));
      vi.advanceTimersByTime(30);
    }
    vi.advanceTimersByTime(150);
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire.mock.calls[1][0][0]).toEqual(at(0, 11));
  });

  it("fires once for '12' typed fast, and twice typed slowly", () => {
    const fast = make();
    fast.scheduler.request(at(0, 0)); // fret 1
    vi.advanceTimersByTime(80);
    fast.scheduler.request(at(0, 0)); // fret 12
    vi.advanceTimersByTime(150);
    expect(fast.onFire).toHaveBeenCalledTimes(1);

    const slow = make();
    slow.scheduler.request(at(0, 0));
    vi.advanceTimersByTime(300);
    slow.scheduler.request(at(0, 0));
    vi.advanceTimersByTime(150);
    expect(slow.onFire).toHaveBeenCalledTimes(2);
  });

  it("an edit followed by ↑/↓ still fires — ↑/↓ never reaches the scheduler", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 1));
    expect(previewAction(at(0, 1, 6), at(0, 1, 5), command("moveString"))).toBe("none");
    vi.advanceTimersByTime(150);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("a rejected second digit leaves the first digit's preview pending", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 1)); // "3" accepted
    expect(previewAction(at(0, 1), at(0, 1), command("setFret", false))).toBe("none"); // "35" rejected
    vi.advanceTimersByTime(150);
    expect(onFire).toHaveBeenCalledWith([at(0, 1)]);
  });

  it("cancel drops the timer and the candidates", () => {
    const { onFire, scheduler } = make();
    scheduler.request(at(0, 1));
    scheduler.cancel();
    vi.advanceTimersByTime(1000);
    expect(onFire).not.toHaveBeenCalled();
    scheduler.request(at(0, 2));
    vi.advanceTimersByTime(150);
    expect(onFire).toHaveBeenCalledWith([at(0, 2)]);
  });
});

describe("createPreviewScheduler with injected timers", () => {
  // No fake timers here: the scheduler only ever talks to the two functions it
  // is given, so a handle is just its 1-based position in `pending`.
  it("hands the previous handle to clearTimer on a restart and on cancel, never after a fire", () => {
    const pending: Array<() => void> = [];
    const delays: number[] = [];
    const cleared: unknown[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onFire = vi.fn((_candidates: Caret[]) => {});
    const scheduler = createPreviewScheduler({
      delayMs: 150,
      onFire,
      maxCandidates: 2,
      setTimer: (fn, ms) => {
        delays.push(ms);
        return pending.push(fn);
      },
      clearTimer: (handle) => {
        cleared.push(handle);
      },
    });

    scheduler.request(at(0, 1));
    expect(cleared).toEqual([]); // nothing was waiting yet
    scheduler.request(at(0, 2));
    scheduler.request(at(0, 3));
    expect(delays).toEqual([150, 150, 150]);
    expect(cleared).toEqual([1, 2]); // each restart dropped the wait before it

    pending[2](); // the third wait runs out
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith([at(0, 3), at(0, 2)]); // maxCandidates: 2 dropped the oldest
    scheduler.cancel();
    scheduler.request(at(0, 4));
    expect(cleared).toEqual([1, 2]); // the fired handle is spent: not cleared again

    scheduler.cancel();
    expect(cleared).toEqual([1, 2, 4]);
    scheduler.cancel();
    expect(cleared).toEqual([1, 2, 4]); // and nothing is left to clear
  });
});
