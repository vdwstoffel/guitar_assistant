import { describe, it, expect } from "vitest";
import { parseTex } from "./parse";

describe("parseTex", () => {
  it("parses a two-bar document and exposes beats", () => {
    const r = parseTex("\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n");
    expect(r.ok).toBe(true);
    expect(r.scoreNode.bars).toHaveLength(2);
    expect(r.scoreNode.bars[0].beats).toHaveLength(3);
    expect(r.scoreNode.bars[1].beats).toHaveLength(2);
  });

  it("exposes codepoint offsets on beat nodes", () => {
    const tex = "\\tempo 120\n.\n3.6.8 5.6 7.6\n";
    const beat = parseTex(tex).scoreNode.bars[0].beats[0];
    expect(typeof beat.start.offset).toBe("number");
    expect(typeof beat.end.offset).toBe("number");
    expect(beat.end.offset).toBeGreaterThan(beat.start.offset);
  });

  it("rejects a semantically invalid document with positioned diagnostics", () => {
    const r = parseTex("\\tempo 120\n.\nz.6.8\n");
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(r.diagnostics[0].line).toBeGreaterThan(0);
  });

  it("rejects unbalanced parentheses", () => {
    expect(parseTex("\\tempo 120\n.\n(((\n").ok).toBe(false);
  });

  it("returns a Score for a valid document", () => {
    expect(parseTex("\\tempo 120\n.\n3.6.8 5.6 7.6\n").score).not.toBeNull();
  });

  it("keeps offsets aligned when the source uses CRLF", () => {
    const beat = parseTex("\\tempo 120\r\n.\r\n3.6.8 5.6 7.6\r\n").scoreNode.bars[0].beats[0];
    expect(beat.start.offset).toBe("\\tempo 120\n.\n".length);
  });
});
