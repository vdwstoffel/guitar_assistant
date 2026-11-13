import { describe, it, expect } from "vitest";
import { moveBeat, moveString } from "./navigate";

const TEX = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

describe("moveBeat", () => {
  it("moves within a bar", () => {
    expect(moveBeat(TEX, at(0, 0), 1)).toEqual(at(0, 1));
  });

  it("crosses forward into the next bar", () => {
    expect(moveBeat(TEX, at(0, 2), 1)).toEqual(at(1, 0));
  });

  it("crosses backward into the previous bar's last beat", () => {
    expect(moveBeat(TEX, at(1, 0), -1)).toEqual(at(0, 2));
  });

  it("stops at the start and end of the document", () => {
    expect(moveBeat(TEX, at(0, 0), -1)).toEqual(at(0, 0));
    expect(moveBeat(TEX, at(1, 1), 1)).toEqual(at(1, 1));
  });

  it("recovers from a caret whose barIndex is already out of range", () => {
    expect(moveBeat(TEX, at(99, 0), 1)).toEqual(at(1, 1));
    expect(moveBeat(TEX, at(-3, 0), -1)).toEqual(at(0, 0));
  });

  it("recovers from a caret whose beatIndex is already out of range", () => {
    expect(moveBeat(TEX, at(0, 99), 1)).toEqual(at(1, 0));
  });
});

describe("moveString", () => {
  it("moves toward the low E and clamps at 6", () => {
    expect(moveString(at(0, 0, 5), 1)).toEqual(at(0, 0, 6));
    expect(moveString(at(0, 0, 6), 1)).toEqual(at(0, 0, 6));
  });

  it("moves toward the high e and clamps at 1", () => {
    expect(moveString(at(0, 0, 2), -1)).toEqual(at(0, 0, 1));
    expect(moveString(at(0, 0, 1), -1)).toEqual(at(0, 0, 1));
  });
});

describe("on a four-string tab", () => {
  const BASS = "\\tuning g2 d2 a1 e1\n\\tempo 120\n.\n3.4.8 5.4 7.3 | 7.4.4 r.4\n";

  it("moveString stops at the lowest string, 4", () => {
    expect(moveString(at(0, 0, 3), 1, 4)).toEqual(at(0, 0, 4));
    expect(moveString(at(0, 0, 4), 1, 4)).toEqual(at(0, 0, 4));
  });

  it("moveString stops at the highest string, 1", () => {
    expect(moveString(at(0, 0, 2), -1, 4)).toEqual(at(0, 0, 1));
    expect(moveString(at(0, 0, 1), -1, 4)).toEqual(at(0, 0, 1));
  });

  it("moveBeat keeps the caret on its string", () => {
    expect(moveBeat(BASS, at(0, 2, 4), 1)).toEqual(at(1, 0, 4));
  });
});
