import { describe, it, expect } from "vitest";
import { barState, brokenBars, overflowBeats, voiceLength } from "./barFill";
import { frac } from "./fraction";
import { parseTex } from "./parse";

const score = (body: string, head = "") => parseTex(`\\tempo 120\n${head}.\n${body}\n`).score;
const state = (body: string, head = "", barIndex = 0) => barState(score(body, head), barIndex);

describe("barState", () => {
  it("is exact for four quarters in 4/4", () => {
    expect(state("3.6.4 5.6 7.6 8.6")).toEqual({ kind: "exact" });
  });

  it("is exact for eight inherited eighths", () => {
    expect(state("0.6.8 0.6 5.6 0.6 3.6 5.6 0.6 3.6")).toEqual({ kind: "exact" });
  });

  it("is short by what is missing", () => {
    expect(state("3.6.8 5.6 7.6 8.6")).toEqual({ kind: "short", amount: frac(1, 2) });
    expect(state("3.6.4")).toEqual({ kind: "short", amount: frac(3, 4) });
  });

  it("is long by the excess — over-full is not full", () => {
    expect(state("0.6.8 0.6 5.6 0.6 3.6 5.6 0.6 3.6 9.6 9.6")).toEqual({ kind: "long", amount: frac(1, 4) });
  });

  it("adds mixed durations exactly", () => {
    expect(state("3.6.2 5.6.4 7.6.8 8.6.8")).toEqual({ kind: "exact" });
    expect(state("3.6.2 5.6.4 7.6.8")).toEqual({ kind: "short", amount: frac(1, 8) });
  });

  it("measures alphaTab's double whole (`.-2`) as two wholes, not as a negative length", () => {
    expect(state("3.6.-2")).toEqual({ kind: "long", amount: frac(1) });
    expect(state("3.6.-2", "\\ts 8 4\n")).toEqual({ kind: "exact" });
  });

  it("respects the time signature", () => {
    expect(state("3.6.4 5.6 7.6", "\\ts 3 4\n")).toEqual({ kind: "exact" });
    expect(state("3.6.4 5.6", "\\ts 3 4\n")).toEqual({ kind: "short", amount: frac(1, 4) });
    expect(state("3.6.4 5.6 7.6 8.6", "\\ts 3 4\n")).toEqual({ kind: "long", amount: frac(1, 4) });
    expect(state("3.6.8 5.6 7.6 8.6 9.6 10.6", "\\ts 6 8\n")).toEqual({ kind: "exact" });
  });

  it("counts dots and double dots", () => {
    expect(state("3.6.4{d} 5.6.8 7.6.2")).toEqual({ kind: "exact" });
    expect(state("3.6.4{dd} 5.6.16 7.6.2")).toEqual({ kind: "exact" });
  });

  it("counts tuplets exactly — a bar of septuplets is not two ticks short", () => {
    expect(state("3.6.8{tu 3} 5.6.8{tu 3} 7.6.8{tu 3} r.4 r.2")).toEqual({ kind: "exact" });
    const five = Array.from({ length: 5 }, () => "3.6.16{tu 5}").join(" ");
    expect(state(`${five} r.4 r.2`)).toEqual({ kind: "exact" });
    const seven = Array.from({ length: 7 }, () => "3.6.16{tu 7}").join(" ");
    expect(state(`${seven} r.4 r.2`)).toEqual({ kind: "exact" });
    expect(state("3.6.8{tu 3} 5.6.8{tu 3} r.4 r.2")).toEqual({ kind: "short", amount: frac(1, 12) });
  });

  it("gives grace notes no length, wherever they sit", () => {
    expect(state("3.6.16{gr} 5.6.4 7.6 8.6 9.6")).toEqual({ kind: "exact" });
    expect(state("3.6.4 5.6 7.6 8.6 | 3.6.16{gr} 5.6.4 7.6 8.6 9.6", "", 1)).toEqual({ kind: "exact" });
    expect(state("3.6.4 5.6 7.6 8.6.16{gr} 9.6.4")).toEqual({ kind: "exact" });
  });

  it("takes a lone whole rest as a full bar in any metre", () => {
    expect(state("r.1", "\\ts 3 4\n")).toEqual({ kind: "exact" });
    expect(state("r.1", "\\ts 6 8\n")).toEqual({ kind: "exact" });
    expect(state("3.6.1", "\\ts 3 4\n")).toEqual({ kind: "long", amount: frac(1, 4) });
  });

  it("exempts a pickup bar", () => {
    expect(state("\\ac 3.6.4 | 3.6.4 5.6 7.6 8.6")).toEqual({ kind: "exempt" });
  });

  it("exempts an empty bar and a bar that does not exist", () => {
    expect(state("3.6.4 5.6 7.6 8.6 | | 3.6.4 5.6 7.6 8.6", "", 1)).toEqual({ kind: "exempt" });
    expect(state("3.6.4 5.6 7.6 8.6", "", 9)).toEqual({ kind: "exempt" });
    expect(barState(null, 0)).toEqual({ kind: "exempt" });
  });

  it("looks at the bar it is asked about", () => {
    const s = score("3.6.4 5.6 7.6 8.6 | 9.6.4");
    expect(barState(s, 0)).toEqual({ kind: "exact" });
    expect(barState(s, 1)).toEqual({ kind: "short", amount: frac(3, 4) });
  });
});

describe("voiceLength", () => {
  it("sums a voice", () => {
    expect(voiceLength(score("3.6.4 5.6.8").tracks[0].staves[0].bars[0].voices[0])).toEqual(frac(3, 8));
  });
});

describe("brokenBars", () => {
  it("lists the short and long bars with their states, in order", () => {
    const s = score("3.6.4 5.6 7.6 8.6 | 3.6.4 | 3.6.2 5.6 7.6 | \\ac 3.6.4");
    expect(brokenBars(s)).toEqual([
      { barIndex: 1, state: { kind: "short", amount: frac(3, 4) } },
      { barIndex: 2, state: { kind: "long", amount: frac(1, 2) } },
    ]);
  });

  it("is empty for no score", () => {
    expect(brokenBars(null)).toEqual([]);
  });
});

describe("overflowBeats", () => {
  it("is the beat across the bar line and every one after it", () => {
    // halves: 0-1/2, 1/2-1, then 1-3/2 starts at the bar line
    expect(overflowBeats(score("3.6.2 5.6 7.6"), 0)).toEqual([2]);
    // 1/2 + dotted half: the dotted half straddles the bar line
    expect(overflowBeats(score("3.6.2 5.6.2{d}"), 0)).toEqual([1]);
    expect(overflowBeats(score("3.6.2 5.6.4 r r"), 0)).toEqual([3]);
  });

  it("is empty for a bar that is not long", () => {
    expect(overflowBeats(score("3.6.4 5.6 7.6 8.6"), 0)).toEqual([]);
    expect(overflowBeats(score("3.6.4"), 0)).toEqual([]);
    expect(overflowBeats(score("\\ac 3.6.1 5.6.1"), 0)).toEqual([]);
  });
});
