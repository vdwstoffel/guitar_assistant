import { describe, it, expect } from "vitest";
import { scaleDuration, toggleDotted } from "./commands/duration";
import { refusedNotice } from "./barMessages";
import { durationNotice, type DurationCommand } from "./durationNotice";
import { parseTex } from "./parse";
import { countBars, type Caret } from "./locate";

const at = (barIndex: number, beatIndex: number, string = 6): Caret => ({ barIndex, beatIndex, string });
const tex = (body: string) => `\\tempo 120\n.\n${body}\n`;

const COMMANDS: Record<DurationCommand, (text: string, caret: Caret) => ReturnType<typeof toggleDotted>> = {
  halve: (text, caret) => scaleDuration(text, caret, "halve"),
  double: (text, caret) => scaleDuration(text, caret, "double"),
  dot: toggleDotted,
};

/**
 * What the editor does with the key: run the command, and ask for a notice
 * only when it did nothing. `acted` is asserted by every test, so a command
 * that stops refusing — or starts — fails here rather than silently turning a
 * case into a different one.
 */
function press(command: DurationCommand, text: string, caret: Caret) {
  const result = COMMANDS[command](text, caret);
  return { acted: result !== null, notice: result === null ? durationNotice(command, text, caret) : null };
}

describe("durationNotice: a duration key refused for a beat it cannot read says so", () => {
  it.each(["halve", "double", "dot"] as const)("%s in a bar it cannot read", (command) => {
    expect(press(command, tex("x.6.4 5.6 7.6 8.6"), at(0, 1))).toEqual({ acted: false, notice: refusedNotice(0, "change") });
  });

  it.each(["halve", "double"] as const)("%s, when the next bar's first beat must be re-pinned and cannot be read", (command) => {
    expect(press(command, tex("3.6.4 r r r | x.5 r r r"), at(0, 0))).toEqual({
      acted: false,
      notice: refusedNotice(0, "change"),
    });
  });

  it("…naming the caret's bar", () => {
    expect(press("halve", tex("3.6.4 5.6 7.6 8.6 | 3.6.4 r r r | x.5 r r r"), at(1, 0))).toEqual({
      acted: false,
      notice: refusedNotice(1, "change"),
    });
  });

  it("…in the words of a command that changes a bar, not of Shift+B, which fixes one", () => {
    expect(press("halve", tex("x.6.4 5.6 7.6 8.6"), at(0, 1)).notice).toBe(
      "Can't change bar 1 automatically — edit it in the source",
    );
  });

  it("but a quoted chord name or text on that beat no longer stops it", () => {
    expect(press("halve", tex('3.6.4 r r r | (3.5 5.4){ch "Am"} r r r'), at(0, 0)).acted).toBe(true);
    expect(press("double", tex('3.6.4 r r r | 3.5{txt "Chorus"} r r r'), at(0, 0)).acted).toBe(true);
  });
});

describe("durationNotice: nothing to do is not a refusal", () => {
  it("halving the shortest value the editor writes", () => {
    expect(press("halve", tex("3.6.64 r r r"), at(0, 0))).toEqual({ acted: false, notice: null });
  });

  it("doubling the longest", () => {
    expect(press("double", tex("3.6.1"), at(0, 0))).toEqual({ acted: false, notice: null });
  });

  it("…however the bar reads: at its limit the key would do nothing anyway", () => {
    expect(press("halve", tex("x.6.4 3.6.64"), at(0, 1))).toEqual({ acted: false, notice: null });
  });

  it("a caret on no beat, and a document that does not parse", () => {
    expect(durationNotice("halve", tex("3.6.4"), at(3, 0))).toBeNull();
    expect(durationNotice("dot", "3.6.4 5.6.8 (((", at(0, 1))).toBeNull();
  });

  it("on plain scores no duration key that does nothing is ever called a refusal", () => {
    // Every caret of three plain scores, every command: whatever returns null
    // here is a limit; none of it is the editor failing to read something.
    const SCORES = [tex("3.6.8 5.6 (7.5 5.4) r | 3.6.1 | 5.6.64 r.64 r r"), tex("3.6.32 5.6.16 r"), tex("r.1")];
    const did: Record<DurationCommand, { nothing: number; something: number }> = {
      halve: { nothing: 0, something: 0 },
      double: { nothing: 0, something: 0 },
      dot: { nothing: 0, something: 0 },
    };
    for (const text of SCORES) {
      const { scoreNode } = parseTex(text);
      for (let barIndex = 0; barIndex < countBars(scoreNode); barIndex++) {
        for (let beatIndex = 0; beatIndex < scoreNode.bars[barIndex].beats.length; beatIndex++) {
          for (const command of Object.keys(COMMANDS) as DurationCommand[]) {
            const { acted, notice } = press(command, text, at(barIndex, beatIndex));
            did[command][acted ? "something" : "nothing"]++;
            expect(notice, `${command} at ${barIndex}:${beatIndex} of ${JSON.stringify(text)}`).toBeNull();
          }
        }
      }
    }
    // Not vacuous: halving and doubling were each seen at their limit and acting; the dot always acts.
    for (const command of ["halve", "double"] as const) {
      expect(did[command].nothing, `${command} never did nothing`).toBeGreaterThan(0);
      expect(did[command].something, `${command} never did anything`).toBeGreaterThan(0);
    }
    expect(did.dot.something).toBeGreaterThan(0);
  });
});
