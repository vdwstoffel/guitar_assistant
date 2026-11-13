import { describe, expect, it } from "vitest";
import { detectSoundBounds, monoSamples } from "./capture";

describe("detectSoundBounds", () => {
  it("finds where the sound starts and stops, a little padded", () => {
    const rate = 8000;
    const samples = new Float32Array(rate * 2.5);
    for (let i = rate; i < rate * 2; i++) samples[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / rate);
    const { start, end } = detectSoundBounds(samples, rate);
    expect(start).toBeGreaterThanOrEqual(0.96);
    expect(start).toBeLessThanOrEqual(0.98);
    expect(end).toBeGreaterThanOrEqual(2.02);
    expect(end).toBeLessThanOrEqual(2.04);
  });

  it("keeps the whole take when it is empty or silent", () => {
    expect(detectSoundBounds(new Float32Array(0), 8000)).toEqual({ start: 0, end: 0 });
    expect(detectSoundBounds(new Float32Array(8000), 8000)).toEqual({ start: 0, end: 1 });
  });
});

describe("monoSamples", () => {
  it("averages the channels, so a take on either input is found", () => {
    const left = new Float32Array([0, 0.5, 1]);
    const right = new Float32Array([0, 0, -1]);
    expect(Array.from(monoSamples([left, right]))).toEqual([0, 0.25, 0]);
  });

  it("copies a single channel rather than sharing it", () => {
    const only = new Float32Array([0.1, 0.2]);
    const mono = monoSamples([only]);
    expect(mono).not.toBe(only);
    expect(Array.from(mono)).toEqual(Array.from(only));
  });
});
