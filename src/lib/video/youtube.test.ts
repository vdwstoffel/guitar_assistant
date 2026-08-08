import { describe, it, expect } from "vitest";
import { extractYoutubeId, watchUrl } from "./youtube";

describe("extractYoutubeId", () => {
  it("parses a standard watch URL", () => {
    expect(extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses a youtu.be short link", () => {
    expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses an embed URL", () => {
    expect(extractYoutubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses a shorts URL", () => {
    expect(extractYoutubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("accepts a bare 11-char id", () => {
    expect(extractYoutubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("trims surrounding whitespace", () => {
    expect(extractYoutubeId("  https://youtu.be/dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for a non-YouTube URL", () => {
    expect(extractYoutubeId("https://example.com/video")).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(extractYoutubeId("")).toBeNull();
  });
});

describe("watchUrl", () => {
  it("builds a canonical watch URL", () => {
    expect(watchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});
