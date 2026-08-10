import { describe, it, expect } from "vitest";
import { parseTempo } from "./tempo";

describe("parseTempo", () => {
  it("returns null for null", () => {
    expect(parseTempo(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseTempo("")).toBeNull();
  });

  it("returns null for non-numeric text", () => {
    expect(parseTempo("fast")).toBeNull();
  });

  it("returns null for zero or negative", () => {
    expect(parseTempo("0")).toBeNull();
    expect(parseTempo("-50")).toBeNull();
  });

  it("parses a plain integer percent", () => {
    expect(parseTempo("82")).toBe(82);
  });

  it("rounds a decimal to the nearest integer", () => {
    expect(parseTempo("99.6")).toBe(100);
  });
});
