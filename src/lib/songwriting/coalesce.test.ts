import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCoalescer } from "./coalesce";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createCoalescer", () => {
  it("applies only the newest of a burst, once, after the last push", () => {
    const applied: number[] = [];
    const c = createCoalescer<number>(200, (v) => applied.push(v));
    for (let i = 1; i <= 5; i++) {
      c.push(i);
      vi.advanceTimersByTime(50);
    }
    expect(applied).toEqual([]);
    expect(c.pending).toBe(true);
    vi.advanceTimersByTime(149);
    expect(applied).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(applied).toEqual([5]);
    expect(c.pending).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(applied).toEqual([5]);
  });

  it("flushes the held value at once", () => {
    const applied: string[] = [];
    const c = createCoalescer<string>(200, (v) => applied.push(v));
    c.push("a");
    c.push("b");
    c.flush();
    expect(applied).toEqual(["b"]);
    vi.advanceTimersByTime(1000);
    expect(applied).toEqual(["b"]);
  });

  it("does nothing on flush with nothing held", () => {
    const apply = vi.fn();
    createCoalescer<string>(200, apply).flush();
    expect(apply).not.toHaveBeenCalled();
  });

  it("drops the held value on cancel", () => {
    const apply = vi.fn();
    const c = createCoalescer<string>(200, apply);
    c.push("a");
    c.cancel();
    expect(c.pending).toBe(false);
    vi.advanceTimersByTime(1000);
    c.flush();
    expect(apply).not.toHaveBeenCalled();
  });
});
