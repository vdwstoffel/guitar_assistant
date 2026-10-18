import { describe, it, expect } from "vitest";
import { formatBeat, isTapped, liftLengthMarkers, parseBeatText, splitLengthMarkers, tokenHead, tokensOf } from "./beatText";
import { parseTex } from "../parse";

describe("tokenHead", () => {
  it("is the property a token sets, without the argument a space or a parenthesis starts", () => {
    expect(tokenHead("pm")).toBe("pm");
    expect(tokenHead("b (0 4)")).toBe("b");
    expect(tokenHead("ah 12")).toBe("ah");
    // alphaTab ignores an empty argument list, with or without the space
    expect(tokenHead("lht()")).toBe("lht");
    expect(tokenHead("h ()")).toBe("h");
    expect(tokensOf("{ss () pm}").map(tokenHead)).toEqual(["ss", "pm"]);
  });
});

describe("isTapped", () => {
  const tapped = (beat: string) => isTapped(parseBeatText(beat)!);

  it("is true when a note is left-hand tapped, whatever else its block holds and however the property is spelled", () => {
    expect(tapped("7.6{lht}.4")).toBe(true);
    expect(tapped("7.6{pm lht}")).toBe(true);
    expect(tapped("7.6{lht()}.4")).toBe(true);
    expect(tapped("7.6{lht ()}.4")).toBe(true);
    expect(tapped("(7.6 5.4{h lht ()}).8")).toBe(true);
  });

  it("is false for a beat of rests and for notes with other properties, a hammer-on included", () => {
    expect(tapped("r.4")).toBe(false);
    expect(tapped("7.6.4")).toBe(false);
    expect(tapped("7.6{h pm}.4")).toBe(false);
    expect(tapped("(7.6{sl} 5.4{b (0 4)}).8")).toBe(false);
  });
});

describe("splitLengthMarkers", () => {
  it("separates dots, double dots, tuplets and graces from the rest", () => {
    expect(splitLengthMarkers(["d", "pm", "tu 3", "dd", "gr"])).toEqual({
      markers: ["d", "tu 3", "dd", "gr"],
      others: ["pm"],
    });
  });

  it("keeps a grace's argument with it, and does not take a bend for one", () => {
    expect(splitLengthMarkers(["gr", "ob", "pm"])).toEqual({ markers: ["gr ob"], others: ["pm"] });
    expect(splitLengthMarkers(["gr", "b (0 4)"])).toEqual({ markers: ["gr"], others: ["b (0 4)"] });
  });

  it("takes the short bend-grace argument, `b`, with its grace", () => {
    expect(splitLengthMarkers(["gr", "b", "pm"])).toEqual({ markers: ["gr b"], others: ["pm"] });
  });
});

describe("liftLengthMarkers", () => {
  it("moves a dot off a duration-less note onto the beat", () => {
    expect(liftLengthMarkers(parseBeatText("5.6{d}")!)).toEqual({
      notes: [{ fret: 5, string: 6, effects: "" }],
      durationSuffix: "",
      effects: "{d}",
    });
  });

  it("moves a tuplet and a grace, leaving the note's own effects", () => {
    expect(liftLengthMarkers(parseBeatText("5.6{tu 3 pm}")!).effects).toBe("{tu 3}");
    expect(liftLengthMarkers(parseBeatText("5.6{tu 3 pm}")!).notes[0].effects).toBe("{pm}");
    expect(liftLengthMarkers(parseBeatText("5.6{gr ob}")!).effects).toBe("{gr ob}");
  });

  it("does not double a marker the beat or another note already has", () => {
    const lifted = liftLengthMarkers(parseBeatText("(5.6{d} 7.5{d h})")!);
    expect(lifted.effects).toBe("{d}");
    expect(lifted.notes.map((n) => n.effects)).toEqual(["", "{h}"]);
  });

  it("keeps the beat's own effects, and does not double a marker the beat already has", () => {
    const lifted = liftLengthMarkers(parseBeatText("(5.6{d} 7.5).8{f d}")!);
    expect(lifted.effects).toBe("{f d}");
    expect(lifted.notes.map((n) => n.effects)).toEqual(["", ""]);
  });

  it("returns a beat with nothing to lift as it is", () => {
    const beat = parseBeatText("5.6{h}.8{d}")!;
    expect(liftLengthMarkers(beat)).toBe(beat);
  });

  // alphaTab applies a beat's markers in the order it reads them — its notes'
  // first, then the beat's own — and the last dot marker wins. A lifted marker
  // goes before the beat's own tokens, and only its last copy is kept, so the
  // marker that won before still wins.
  it("lets the beat's own marker still win over a lifted one", () => {
    expect(liftLengthMarkers(parseBeatText("(3.3{d} 5.5){dd}")!).effects).toBe("{d dd}");
  });

  it("keeps the last of several lifted markers last", () => {
    expect(liftLengthMarkers(parseBeatText("(3.3{d} 5.5{dd} 6.4{d})")!).effects).toBe("{dd d}");
  });

  it.each(["(3.3{d} 5.5){dd}", "(3.3{d} 5.5{dd} 6.4{d})", "(3.3{dd} 5.5){d}", "(5.6{d} 7.5).8{f d}"])(
    "leaves %s as long as it was, by alphaTab's reading",
    (source) => {
      const dots = (beat: string) => parseTex(`\\tempo 120\n.\n${beat}\n`).score.tracks[0].staves[0].bars[0].voices[0].beats[0].dots;
      expect(dots(formatBeat(liftLengthMarkers(parseBeatText(source)!)))).toBe(dots(source));
    },
  );
});
