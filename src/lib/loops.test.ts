import { describe, it, expect } from "vitest";
import { validateLoopInput } from "./loops";

describe("validateLoopInput", () => {
  it("accepts a valid loop and trims the name", () => {
    const r = validateLoopInput({ name: "  Solo  ", startTime: 5, endTime: 12.5 });
    expect(r).toEqual({ ok: true, value: { name: "Solo", startTime: 5, endTime: 12.5 } });
  });

  it("rejects a missing/blank name", () => {
    expect(validateLoopInput({ name: "   ", startTime: 0, endTime: 1 }).ok).toBe(false);
    expect(validateLoopInput({ startTime: 0, endTime: 1 }).ok).toBe(false);
  });

  it("rejects when startTime >= endTime", () => {
    expect(validateLoopInput({ name: "x", startTime: 3, endTime: 3 }).ok).toBe(false);
    expect(validateLoopInput({ name: "x", startTime: 4, endTime: 2 }).ok).toBe(false);
  });

  it("rejects non-finite or negative times", () => {
    expect(validateLoopInput({ name: "x", startTime: -1, endTime: 2 }).ok).toBe(false);
    expect(validateLoopInput({ name: "x", startTime: 0, endTime: Infinity }).ok).toBe(false);
    expect(validateLoopInput({ name: "x", startTime: "0", endTime: 2 }).ok).toBe(false);
  });

  it("rejects a non-object input", () => {
    expect(validateLoopInput(null).ok).toBe(false);
    expect(validateLoopInput("nope").ok).toBe(false);
  });
});
