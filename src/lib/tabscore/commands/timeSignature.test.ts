import { describe, it, expect } from "vitest";
import {
  setTimeSignature,
  readTimeSignature,
  isValidTimeSignature,
  TIME_SIGNATURE_PRESETS,
} from "./timeSignature";
import { parseTex } from "../parse";

const TEX = "\\tempo 120\n.\n3.6.4 r.4 r.4 r.4 | 5.6.4 r.4 r.4 r.4 | 7.6.4 r.4 r.4 r.4\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
const ts = (numerator: number, denominator: number) => ({ numerator, denominator });

function score(text: string) {
  const parsed = parseTex(text);
  expect(parsed.ok, text).toBe(true);
  return parsed.score;
}

/** What alphaTab ends up believing each bar's time signature is. */
function meters(text: string): string[] {
  // parseTex's Score comes back from the untyped alphaTex interop boundary.
  return (score(text).masterBars as { timeSignatureNumerator: number; timeSignatureDenominator: number }[]).map(
    (mb) => `${mb.timeSignatureNumerator}/${mb.timeSignatureDenominator}`,
  );
}

describe("isValidTimeSignature", () => {
  it("takes any count of a power-of-two note value", () => {
    expect(isValidTimeSignature(ts(7, 8))).toBe(true);
    expect(isValidTimeSignature(ts(2, 2))).toBe(true);
    expect(isValidTimeSignature(ts(11, 16))).toBe(true);
  });

  it("refuses what no time signature can say", () => {
    expect(isValidTimeSignature(ts(0, 4))).toBe(false);
    expect(isValidTimeSignature(ts(3, 3))).toBe(false);
    expect(isValidTimeSignature(ts(2.5, 4))).toBe(false);
    expect(isValidTimeSignature(ts(4, 64))).toBe(false);
  });

  it("holds for every preset the control offers", () => {
    for (const preset of TIME_SIGNATURE_PRESETS) expect(isValidTimeSignature(preset)).toBe(true);
  });
});

describe("readTimeSignature", () => {
  it("is 4/4 where the tab never says otherwise — alphaTab's default", () => {
    expect(readTimeSignature(score(TEX), 0)).toEqual(ts(4, 4));
    expect(readTimeSignature(score(TEX), 2)).toEqual(ts(4, 4));
  });

  it("reads the change a bar carries, and the bars after it inherit it", () => {
    const text = "\\tempo 120\n.\nr r r r | \\ts (3 4) r r r | r r r\n";
    expect(readTimeSignature(score(text), 0)).toEqual(ts(4, 4));
    expect(readTimeSignature(score(text), 1)).toEqual(ts(3, 4));
    expect(readTimeSignature(score(text), 2)).toEqual(ts(3, 4));
  });

  it("is null for a bar that is not there", () => {
    expect(readTimeSignature(score(TEX), 9)).toBeNull();
  });
});

describe("setTimeSignature", () => {
  it("writes the change on the caret's bar, before its first beat", () => {
    const next = setTimeSignature(TEX, at(1, 0), 1, ts(3, 4))!.text;
    expect(next).toContain("| \\ts (3 4) 5.6.4");
    expect(meters(next)).toEqual(["4/4", "3/4", "3/4"]);
  });

  it("writes it parenthesised, which alphaTab reads without a warning", () => {
    // `\ts 3 4` works too, but alphaTab 1.8 warns "Metadata arguments should
    // be wrapped into parenthesis" — a warning the source pane would show.
    const next = setTimeSignature(TEX, at(1, 0), 1, ts(6, 8))!.text;
    expect(parseTex(next).diagnostics.filter((d) => d.severity !== "hint")).toEqual([]);
  });

  it("carries on until the next change, as written music does", () => {
    const text = "\\tempo 120\n.\nr r r r | r r r r | \\ts (6 8) r.8 r r r r r\n";
    const next = setTimeSignature(text, at(0, 0), 0, ts(3, 4))!.text;
    expect(meters(next)).toEqual(["3/4", "3/4", "6/8"]);
  });

  it("rewrites a change already on the bar rather than adding a second", () => {
    const first = setTimeSignature(TEX, at(1, 0), 1, ts(3, 4))!.text;
    const second = setTimeSignature(first, at(1, 0), 1, ts(6, 8))!.text;
    expect(second.match(/\\ts/g)!.length).toBe(1);
    expect(meters(second)).toEqual(["4/4", "6/8", "6/8"]);
  });

  it("takes the change off when the bar goes back to the metre before it", () => {
    const on = setTimeSignature(TEX, at(1, 0), 1, ts(3, 4))!.text;
    expect(setTimeSignature(on, at(1, 0), 1, ts(4, 4))!.text).toBe(TEX);
  });

  it("rewrites a time signature in the header in place", () => {
    // Tabs from elsewhere (Guitar Pro, Songsterr, hand-written) often state
    // the opening metre before the `.`, unparenthesised.
    const text = "\\tempo 120\n\\ts 3 4\n.\nr r r | r r r\n";
    const next = setTimeSignature(text, at(0, 0), 0, ts(6, 8))!.text;
    expect(next).toBe("\\tempo 120\n\\ts (6 8)\n.\nr r r | r r r\n");
    expect(meters(next)).toEqual(["6/8", "6/8"]);
  });

  it("takes a header time signature out when set back to 4/4", () => {
    const text = "\\tempo 120\n\\ts 3 4\n.\nr r r | r r r\n";
    expect(setTimeSignature(text, at(0, 0), 0, ts(4, 4))!.text).toBe("\\tempo 120\n.\nr r r | r r r\n");
  });

  it("does nothing when the bar is already in that metre", () => {
    expect(setTimeSignature(TEX, at(1, 0), 1, ts(4, 4))).toBeNull();
  });

  it("leaves the notes alone, so a bar that no longer fits is flagged rather than rewritten", () => {
    const next = setTimeSignature(TEX, at(1, 0), 1, ts(3, 4))!.text;
    expect(next).toContain("5.6.4 r.4 r.4 r.4 | 7.6.4 r.4 r.4 r.4");
    expect(meters(next).length).toBe(3);
  });

  it("keeps a repeat sign on the same bar", () => {
    const text = "\\tempo 120\n.\nr r r r | \\ro r r r r | r r r r\n";
    const next = setTimeSignature(text, at(1, 0), 1, ts(3, 4))!.text;
    expect(score(next).masterBars[1].isRepeatStart).toBe(true);
    expect(meters(next)[1]).toBe("3/4");
  });

  it("leaves the caret where it was", () => {
    expect(setTimeSignature(TEX, at(2, 3, 4), 1, ts(3, 4))!.caret).toEqual(at(2, 3, 4));
  });

  it("refuses a time signature that cannot be written", () => {
    expect(setTimeSignature(TEX, at(1, 0), 1, ts(3, 3))).toBeNull();
    expect(setTimeSignature(TEX, at(1, 0), 1, ts(0, 4))).toBeNull();
  });

  it("rejects a bar outside the document", () => {
    expect(setTimeSignature(TEX, at(0, 0), 9, ts(3, 4))).toBeNull();
    expect(setTimeSignature(TEX, at(0, 0), -1, ts(3, 4))).toBeNull();
  });

  it("leaves the document alone when it does not parse", () => {
    expect(setTimeSignature("\\tempo 120\n.\n(((\n", at(0, 0), 0, ts(3, 4))).toBeNull();
  });
});
