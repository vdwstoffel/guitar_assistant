import { describe, it, expect } from "vitest";
import { parseTex } from "./parse";

function bigDocument(bars: number): string {
  const bar = "3.6.8 5.6 7.6 8.6";
  return `\\tempo 120\n.\n${Array.from({ length: bars }, () => bar).join(" | ")}\n`;
}

describe("parse performance", () => {
  it("parses a 300-bar document well inside a keystroke budget", () => {
    const doc = bigDocument(300);
    expect(parseTex(doc).ok).toBe(true);

    const runs = 20;
    const started = performance.now();
    for (let i = 0; i < runs; i++) parseTex(doc);
    const perParse = (performance.now() - started) / runs;

    console.log(`300-bar parse: ${perParse.toFixed(2)} ms`);
    // Generous ceiling: a keystroke has ~16 ms before it feels laggy, and the
    // re-render dominates. If this ever fails, cache the parse per bar.
    expect(perParse).toBeLessThan(50);
  });
});
