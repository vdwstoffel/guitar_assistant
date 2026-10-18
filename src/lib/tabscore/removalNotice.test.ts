import { describe, it, expect } from "vitest";
import { clearNote } from "./commands/setFret";
import { deleteBar, deleteBeat } from "./commands/structure";
import { refusedNotice } from "./barMessages";
import { removalNotice, type RemovalCommand } from "./removalNotice";
import { parseTex } from "./parse";
import { countBars, type Caret } from "./locate";

const at = (barIndex: number, beatIndex: number, string = 6): Caret => ({ barIndex, beatIndex, string });
const tex = (body: string) => `\\tempo 120\n.\n${body}\n`;

const COMMANDS = { clearNote, deleteBeat, deleteBar } as const;

/**
 * What the editor does with the key: run the command, and ask for a notice
 * only when it did nothing. `acted` is asserted by every test, so a command
 * that stops refusing — or starts — fails here rather than silently turning
 * a case into a different one.
 */
function press(command: RemovalCommand, text: string, caret: Caret) {
  const result = COMMANDS[command](text, caret);
  return { acted: result !== null, notice: result === null ? removalNotice(command, text, caret) : null };
}

describe("removalNotice: a delete refused for a beat it cannot re-pin says so", () => {
  it("Shift+Delete, the next beat a dead note that would have to inherit another duration", () => {
    expect(press("deleteBeat", tex("3.6.4 5.6.8 x.6"), at(0, 1))).toEqual({
      acted: false,
      notice: refusedNotice(0, "change"),
    });
  });

  it("…naming the caret's bar, not the first", () => {
    expect(press("deleteBeat", tex("3.6.4 5.6.4 | 3.6.4 5.6.8 x.6"), at(1, 1))).toEqual({
      acted: false,
      notice: refusedNotice(1, "change"),
    });
  });

  it("…also when that beat is the first of the next bar", () => {
    expect(press("deleteBeat", tex("3.6.4 5.6.8 | x.6 7.6"), at(0, 1))).toEqual({
      acted: false,
      notice: refusedNotice(0, "change"),
    });
  });

  it("Ctrl+Shift+Backspace, the next bar's first beat a dead note", () => {
    expect(press("deleteBar", tex("3.6.8 5.6 | x.6 r"), at(0, 0))).toEqual({
      acted: false,
      notice: refusedNotice(0, "change"),
    });
  });

  it("…or one that carries a quoted argument and a dot that would have to be lifted", () => {
    expect(press("deleteBeat", tex('3.6.8 (5.6{d} 7.5){ch "Am"}'), at(0, 0))).toEqual({
      acted: false,
      notice: refusedNotice(0, "change"),
    });
  });

  it("…but not one that carries a quoted argument alone, which is pinned as written", () => {
    expect(press("deleteBeat", tex('3.6.8 5.6{ch "Am"}'), at(0, 0))).toEqual({ acted: true, notice: null });
  });

  it("but a beat with a duration of its own needs no re-pin, so the delete goes ahead", () => {
    expect(press("deleteBeat", tex("3.6.4 5.6.8 x.6.4"), at(0, 1)).acted).toBe(true);
    expect(press("deleteBar", tex("3.6.8 5.6 | x.6.4 r"), at(0, 0)).acted).toBe(true);
  });
});

describe("removalNotice: Delete on a beat's last note, refused by a beat it cannot read", () => {
  // The tie and legato cleanup walks on to the next note on the string, and an
  // unreadable beat might hold it (dead notes are not read: see parseBeatText).
  const BLOCKED = tex("5.6.4 x.1.4 r r");

  it("says so, for the caret's bar", () => {
    expect(press("clearNote", BLOCKED, at(0, 0))).toEqual({ acted: false, notice: refusedNotice(0, "change") });
    expect(press("clearNote", tex("3.6.4 5.6.4 | 5.6.4 x.1.4 r r"), at(1, 0))).toEqual({
      acted: false,
      notice: refusedNotice(1, "change"),
    });
  });

  it("stays quiet when the caret's string has no note to clear", () => {
    expect(press("clearNote", BLOCKED, at(0, 0, 3))).toEqual({ acted: false, notice: null });
    expect(press("clearNote", BLOCKED, at(0, 2))).toEqual({ acted: false, notice: null }); // a rest
  });

  it("stays quiet on a beat it cannot read at all: what it holds is not known", () => {
    expect(press("clearNote", BLOCKED, at(0, 1, 1))).toEqual({ acted: false, notice: null });
  });

  it("a chord's note is unbound like a lone note, so the same beat in the way is a refusal there too", () => {
    expect(press("clearNote", tex("(5.6 3.5).4 x.1.4 r r"), at(0, 0))).toEqual({ acted: false, notice: refusedNotice(0, "change") });
  });

  it("a chord's note goes when the walk settles before the beat it cannot read", () => {
    expect(press("clearNote", tex("(5.6 3.5).4 7.6 x.1.4 r"), at(0, 0)).acted).toBe(true);
  });
});

describe("removalNotice: nothing to delete is not a refusal", () => {
  it("a bar's only beat cannot go, and nobody is told it is a problem with the bar", () => {
    expect(press("deleteBeat", tex("3.6.4 | 5.6.4 7.6.4"), at(0, 0))).toEqual({ acted: false, notice: null });
  });

  it("a score's only bar cannot go", () => {
    expect(press("deleteBar", tex("3.6.4 5.6.4"), at(0, 0))).toEqual({ acted: false, notice: null });
  });

  it("an empty string on a plain score", () => {
    expect(press("clearNote", tex("3.6.4 5.6.4"), at(0, 0, 2))).toEqual({ acted: false, notice: null });
  });

  it("a document that does not parse has nothing to say either", () => {
    expect(removalNotice("deleteBeat", "3.6.4 5.6.8 (((", at(0, 1))).toBeNull();
    expect(removalNotice("clearNote", "3.6.4 5.6.8 (((", at(0, 1))).toBeNull();
  });

  it("on plain scores no delete that does nothing is ever called a refusal", () => {
    // Three plain bars (chords, rests, mixed durations, a bar of one beat) and a
    // one-bar score: every caret, every string, every command. Whatever returns
    // null here is a limit; none of it is the editor failing to read something.
    const SCORES = [
      tex("3.6.8 5.6 (7.5 5.4) r | 3.6.4 r r.2 | 5.6.1"),
      tex("3.6.8 5.6.4 r"),
      tex("r"),
    ];
    const did: Record<RemovalCommand, { nothing: number; something: number }> = {
      clearNote: { nothing: 0, something: 0 },
      deleteBeat: { nothing: 0, something: 0 },
      deleteBar: { nothing: 0, something: 0 },
    };
    for (const text of SCORES) {
      const { scoreNode } = parseTex(text);
      for (let barIndex = 0; barIndex < countBars(scoreNode); barIndex++) {
        for (let beatIndex = 0; beatIndex < scoreNode.bars[barIndex].beats.length; beatIndex++) {
          for (let string = 1; string <= 6; string++) {
            for (const command of Object.keys(COMMANDS) as RemovalCommand[]) {
              const { acted, notice } = press(command, text, at(barIndex, beatIndex, string));
              did[command][acted ? "something" : "nothing"]++;
              expect(notice, `${command} at ${barIndex}:${beatIndex}:${string} of ${JSON.stringify(text)}`).toBeNull();
            }
          }
        }
      }
    }
    // Not vacuous: each command was seen doing nothing (its limit) and doing something.
    for (const command of Object.keys(did) as RemovalCommand[]) {
      expect(did[command].nothing, `${command} never did nothing`).toBeGreaterThan(0);
      expect(did[command].something, `${command} never did anything`).toBeGreaterThan(0);
    }
  });
});
