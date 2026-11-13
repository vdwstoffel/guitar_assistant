import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAlphaTabWorklet, settlesWithin, type WorkletContext } from "./alphaTabWorklet";

function fakeContext(result: Promise<void> = Promise.resolve()) {
  const addModule = vi.fn((url: string) => {
    void url;
    return result;
  });
  const ctx: WorkletContext = { audioWorklet: { addModule } };
  return { ctx, addModule };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("loadAlphaTabWorklet", () => {
  it("adds the module once per context and hands back the same promise", () => {
    const { ctx, addModule } = fakeContext();
    const first = loadAlphaTabWorklet(ctx);
    const second = loadAlphaTabWorklet(ctx);
    expect(second).toBe(first);
    expect(addModule).toHaveBeenCalledTimes(1);
    expect(addModule).toHaveBeenCalledWith("/alphaTab.worklet.mjs");
  });

  it("loads separately for a different context", () => {
    const a = fakeContext();
    const b = fakeContext();
    loadAlphaTabWorklet(a.ctx);
    loadAlphaTabWorklet(b.ctx);
    expect(a.addModule).toHaveBeenCalledTimes(1);
    expect(b.addModule).toHaveBeenCalledTimes(1);
  });

  it("runs a later caller's continuation as a microtask once loaded", async () => {
    const { ctx } = fakeContext();
    await loadAlphaTabWorklet(ctx);
    const order: string[] = [];
    void loadAlphaTabWorklet(ctx).then(() => order.push("started"));
    // A message event from the synth worker is a macrotask: it comes after.
    await new Promise((r) => setTimeout(r, 0));
    order.push("next message");
    expect(order).toEqual(["started", "next message"]);
  });
});

describe("settlesWithin", () => {
  it("is true for a promise that resolves in time", async () => {
    await expect(settlesWithin(Promise.resolve(), 1000)).resolves.toBe(true);
  });

  it("is false for a rejection", async () => {
    await expect(settlesWithin(Promise.reject(new Error("no")), 1000)).resolves.toBe(false);
  });

  it("is false for a promise that never settles", async () => {
    vi.useFakeTimers();
    const result = settlesWithin(new Promise(() => {}), 6000);
    vi.advanceTimersByTime(6000);
    await expect(result).resolves.toBe(false);
  });
});
