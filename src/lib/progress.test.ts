import { describe, it, expect } from "vitest";
import { resetProgressData, PRESERVED_PROGRESS_FIELDS } from "./progress";

describe("resetProgressData", () => {
  it("clears the completed / in-progress state", () => {
    expect(resetProgressData()).toEqual({
      completed: false,
      completedAt: null,
      inProgress: false,
    });
  });

  it("does not touch fields that record listening history", () => {
    const data = resetProgressData();
    for (const field of PRESERVED_PROGRESS_FIELDS) {
      expect(data).not.toHaveProperty(field);
    }
  });

  it("preserves lastPlayedAt and favorite", () => {
    // Guard against a future edit widening the reset into play history.
    expect(PRESERVED_PROGRESS_FIELDS).toContain("lastPlayedAt");
    expect(PRESERVED_PROGRESS_FIELDS).toContain("favorite");
  });

  it("returns a fresh object each call so callers cannot mutate shared state", () => {
    const a = resetProgressData();
    const b = resetProgressData();
    expect(a).not.toBe(b);
  });
});
