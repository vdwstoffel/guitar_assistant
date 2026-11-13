import { describe, it, expect } from "vitest";
import { audioExtension } from "./mime";

describe("audioExtension", () => {
  it("maps known types, ignoring codec parameters", () => {
    expect(audioExtension("audio/webm;codecs=opus")).toBe(".webm");
    expect(audioExtension("audio/ogg")).toBe(".ogg");
    expect(audioExtension("audio/mpeg")).toBe(".mp3");
  });
  it("falls back to .webm", () => {
    expect(audioExtension("weird/type")).toBe(".webm");
  });
});
