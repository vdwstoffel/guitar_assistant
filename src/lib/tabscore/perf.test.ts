import { describe, it, expect } from "vitest";
import { parseTex } from "./parse";
import { brokenBars } from "./barFill";
import { scaleDuration } from "./commands/duration";
import { makeRest } from "./commands/rest";
import { clearNote } from "./commands/setFret";
import { fixBar } from "./commands/fixBar";
import { selectAll } from "./selection";
import { copyRange, readClip } from "./clip";
import { clearRange, removeRange } from "./commands/rangeEdit";
import { pasteOverwrite } from "./commands/paste";
import { duplicate } from "./commands/duplicate";

function bigDocument(bars: number, bar = "3.6.8 5.6 7.6 8.6"): string {
  return `\\tempo 120\n.\n${Array.from({ length: bars }, () => bar).join(" | ")}\n`;
}

describe("parse performance", () => {
  it("parses a 300-bar document well inside a keystroke budget", () => {
    const doc = bigDocument(300);
    expect(parseTex(doc).ok).toBe(true);

    const runs = 20;
    const started = performance.now();
    for (let i = 0; i < runs; i++) parseTex(doc);
    const perParse = (performance.now() - started) / runs;

    console.log(`300-bar parse: ${perParse.toFixed(2)} ms`);
    // Generous ceiling: a keystroke has ~16 ms before it feels laggy, and the
    // re-render dominates. If this ever fails, cache the parse per bar.
    expect(perParse).toBeLessThan(50);
  });

  it("runs the bar commands on a 300-bar document well inside a keystroke budget", () => {
    // Every bar here is short (four 8ths in 4/4): the most the measure ever says.
    const doc = bigDocument(300);
    const mid = { barIndex: 150, beatIndex: 0, string: 6 };
    // The timings mean something only if each command does its work here
    // rather than refusing at its gate.
    expect(scaleDuration(doc, mid, "double")).not.toBeNull();
    expect(makeRest(doc, mid).kind).toBe("ok");
    expect(fixBar(doc, mid).kind).toBe("ok");
    expect(brokenBars(parseTex(doc).score)).toHaveLength(300);

    const timed: Array<[string, () => unknown]> = [
      ["scaleDuration", () => scaleDuration(doc, mid, "double")],
      ["makeRest", () => makeRest(doc, mid)],
      ["fixBar", () => fixBar(doc, mid)],
      ["brokenBars", () => brokenBars(parseTex(doc).score)],
    ];
    for (const [name, run] of timed) {
      const runs = 10;
      const started = performance.now();
      for (let i = 0; i < runs; i++) run();
      const each = (performance.now() - started) / runs;
      console.log(`300-bar ${name}: ${each.toFixed(2)} ms`);
      // Each parses three or four times. Generous, for a margin when another
      // suite runs at the same time; a quadratic blowup still fails it.
      expect(each, name).toBeLessThan(200);
    }
  });

  it("runs the selection commands on a 300-bar document well inside a keystroke budget", () => {
    // Bars of eight 8ths, as full as 4/4 holds: twice the beats of the bars above.
    // Without the table in offsets.ts — every conversion of a codepoint offset
    // walking the text from its start — clearRange, all takes ~500 ms here, far
    // over the ceiling; at four beats a bar it took 150-230 ms, on its edge.
    const doc = bigDocument(300, "3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 8.6");
    const all = selectAll(parseTex(doc).scoreNode)!;
    const mid = { barIndex: 150, beatIndex: 0, string: 6 };
    const twoBars = { from: { barIndex: 150, beatIndex: 0 }, to: { barIndex: 151, beatIndex: 7 } };
    const clipBar = "5.6.8 7.6 9.6 10.6 5.6 7.6 9.6 10.6";
    const eightBars = readClip(`${Array.from({ length: 8 }, () => clipBar).join(" | ")} |`)!;
    // As above: timed only once each is seen to do its work, not refuse at its gate.
    expect(clearRange(doc, mid, all).kind).toBe("ok");
    expect(copyRange(doc, all).kind).toBe("copied");
    expect(removeRange(doc, mid, twoBars).kind).toBe("ok");
    expect(pasteOverwrite(doc, mid, eightBars).kind).toBe("ok");
    expect(duplicate(doc, mid, null).kind).toBe("ok");

    const timed: Array<[string, () => unknown]> = [
      // Every beat of the tab read and rewritten: the case the spec bounds.
      ["clearRange, all", () => clearRange(doc, mid, all)],
      ["copyRange, all", () => copyRange(doc, all)],
      ["removeRange, two bars", () => removeRange(doc, mid, twoBars)],
      ["pasteOverwrite, eight bars", () => pasteOverwrite(doc, mid, eightBars)],
      ["duplicate, a bar", () => duplicate(doc, mid, null)],
    ];
    for (const [name, run] of timed) {
      run(); // warm
      const runs = 5;
      const started = performance.now();
      for (let i = 0; i < runs; i++) run();
      const each = (performance.now() - started) / runs;
      console.log(`300-bar ${name}: ${each.toFixed(2)} ms`);
      // The bar commands' ceiling, for the same margin.
      expect(each, name).toBeLessThan(200);
    }
  });

  it("unbinds a lone note at the end of a 300-bar tab without walking the whole tab", () => {
    // Every other note is on the low E, so the walks for the high e would find
    // nothing to stop them and read all 300 bars, each read slicing the text
    // from its start: quadratic, and once per string. They stop at alphaTab's
    // three-bar reach.
    const bar = "3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 8.6";
    const tab = (last: string) => `\\tempo 120\n.\n${[...Array.from({ length: 299 }, () => bar), `3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 ${last}`].join(" | ")}\n`;
    const lone = tab("12.1");
    const chord = tab("(12.1 12.2 12.3 12.4 12.5)");
    const caret = { barIndex: 299, beatIndex: 7, string: 1 };
    expect(makeRest(lone, caret).kind).toBe("ok");
    expect(clearNote(lone, caret)).not.toBeNull();
    expect(makeRest(chord, caret).kind).toBe("ok");

    const timed: Array<[string, () => unknown]> = [
      ["makeRest, lone high e", () => makeRest(lone, caret)],
      ["clearNote, lone high e", () => clearNote(lone, caret)],
      ["makeRest, a chord on the five strings nothing else plays", () => makeRest(chord, caret)],
    ];
    for (const [name, run] of timed) {
      const runs = 10;
      const started = performance.now();
      for (let i = 0; i < runs; i++) run();
      const each = (performance.now() - started) / runs;
      console.log(`300-bar ${name}: ${each.toFixed(2)} ms`);
      expect(each, name).toBeLessThan(200);
    }
  });
});
