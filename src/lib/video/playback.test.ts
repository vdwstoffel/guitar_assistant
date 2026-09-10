import { describe, it, expect } from "vitest";
import { loopSeekTarget } from "./playback";

describe("loopSeekTarget", () => {
  it("returns null when either point is unset", () => {
    expect(loopSeekTarget(10, null, 20)).toBeNull();
    expect(loopSeekTarget(10, 5, null)).toBeNull();
  });
  it("returns null when b <= a (invalid range)", () => {
    expect(loopSeekTarget(30, 20, 20)).toBeNull();
    expect(loopSeekTarget(30, 25, 20)).toBeNull();
  });
  it("returns null while still before b", () => {
    expect(loopSeekTarget(15, 10, 20)).toBeNull();
  });
  it("returns a when at or past b", () => {
    expect(loopSeekTarget(20, 10, 20)).toBe(10);
    expect(loopSeekTarget(25, 10, 20)).toBe(10);
  });
});
