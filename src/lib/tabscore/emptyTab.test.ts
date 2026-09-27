import { describe, it, expect } from "vitest";
import { emptyTabTex } from "./emptyTab";
import { parseTex } from "./parse";
import { setFret } from "./commands/setFret";
import { scaleDuration } from "./commands/duration";
import { addBar } from "./commands/structure";
import { readTempo } from "./commands/tempo";

const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
const body = (tex: string) => tex.split("\n")[2];

describe("emptyTabTex", () => {
  it("parses, with one bar of four beats", () => {
    const r = parseTex(emptyTabTex(120));
    expect(r.ok).toBe(true);
    expect(r.scoreNode.bars).toHaveLength(1);
    expect(r.scoreNode.bars[0].beats).toHaveLength(4);
  });

  it("carries the requested tempo", () => {
    expect(readTempo(emptyTabTex(96))).toBe(96);
  });

  it("emits no duration suffixes, so beats can inherit", () => {
    expect(body(emptyTabTex(120))).toBe("r r r r");
  });
});

describe("note entry is sticky (the reported bug)", () => {
  it("carries the chosen duration to the next beat instead of resetting", () => {
    let tex = emptyTabTex(120);
    tex = setFret(tex, at(0, 0), 3)!.text;
    tex = scaleDuration(tex, at(0, 0), "halve")!.text;
    tex = scaleDuration(tex, at(0, 0), "halve")!.text;
    expect(body(tex)).toBe("3.6.16 r r r");

    // The next beat filled in must be a sixteenth too, NOT a quarter.
    tex = setFret(tex, at(0, 1), 5)!.text;
    expect(body(tex)).toBe("3.6.16 5.6 r r");

    const beats = parseTex(tex).score.tracks[0].staves[0].bars[0].voices[0].beats;
    expect(beats[1].duration).toBe(beats[0].duration);
  });

  it("carries it across a bar boundary too", () => {
    let tex = emptyTabTex(120);
    tex = setFret(tex, at(0, 0), 3)!.text;
    tex = scaleDuration(tex, at(0, 0), "halve")!.text;
    tex = addBar(tex, at(0, 0))!.text;
    tex = setFret(tex, at(1, 0), 9)!.text;

    const bars = parseTex(tex).score.tracks[0].staves[0].bars;
    expect(bars[1].voices[0].beats[0].duration).toBe(bars[0].voices[0].beats[0].duration);
  });
});
