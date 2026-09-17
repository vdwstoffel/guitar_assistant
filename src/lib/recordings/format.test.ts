import { describe, it, expect } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("renders a dash for missing durations", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(NaN)).toBe("—");
    expect(formatDuration(Infinity)).toBe("—");
  });

  it("pads seconds to two digits", () => {
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
  });

  it("rolls over into minutes", () => {
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(599)).toBe("9:59");
    expect(formatDuration(3600)).toBe("60:00");
  });

  it("truncates fractional seconds", () => {
    expect(formatDuration(1.9)).toBe("0:01");
  });

  it("renders a dash for negative durations", () => {
    expect(formatDuration(-5)).toBe("—");
  });
});
