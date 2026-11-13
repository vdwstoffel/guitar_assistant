import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionTransport } from "./sessionTransport";

function setup(ready = true) {
  const state = { ready, plays: 0, changes: [] as boolean[] };
  const transport = createSessionTransport({
    isReady: () => state.ready,
    play: () => {
      state.plays += 1;
    },
    onPendingChange: (p) => state.changes.push(p),
  });
  return { state, transport };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createSessionTransport", () => {
  it("starts at once when ready, and stays pending until the player confirms", () => {
    const { state, transport } = setup();
    transport.start();
    expect(state.plays).toBe(1);
    expect(transport.pending).toBe(true);
    transport.confirmPlaying();
    expect(transport.pending).toBe(false);
    expect(state.changes).toEqual([true, false]);
    vi.advanceTimersByTime(10_000);
    expect(state.plays).toBe(1);
  });

  it("polls a start until the player is ready", () => {
    const { state, transport } = setup(false);
    transport.start();
    vi.advanceTimersByTime(300);
    expect(state.plays).toBe(0);
    state.ready = true;
    vi.advanceTimersByTime(100);
    expect(state.plays).toBe(1);
  });

  it("does nothing on reload when it was not playing", () => {
    const { state, transport } = setup();
    transport.reload(false);
    transport.kick();
    vi.advanceTimersByTime(10_000);
    expect(state.plays).toBe(0);
    expect(transport.pending).toBe(false);
    expect(state.changes).toEqual([]);
  });

  it("resumes after a reload only once kicked, and never synchronously", () => {
    const { state, transport } = setup();
    transport.reload(true);
    expect(transport.pending).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(state.plays).toBe(0);
    transport.kick();
    expect(state.plays).toBe(0);
    vi.advanceTimersByTime(99);
    expect(state.plays).toBe(0);
    vi.advanceTimersByTime(1);
    expect(state.plays).toBe(1);
  });

  it("plays once for repeated kicks of the same reload", () => {
    const { state, transport } = setup();
    transport.reload(true);
    transport.kick();
    transport.kick();
    vi.advanceTimersByTime(50);
    transport.kick();
    vi.advanceTimersByTime(5_000);
    expect(state.plays).toBe(1);
  });

  it("lets a newer reload supersede a pending one, keeping the intent to play", () => {
    const { state, transport } = setup();
    transport.reload(true);
    transport.kick();
    vi.advanceTimersByTime(50);
    // The second change lands while the first is still polling; the player is
    // now stopped, so it reports "not playing" — the pending resume carries.
    transport.reload(false);
    expect(transport.pending).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(state.plays).toBe(0);
    transport.kick();
    vi.advanceTimersByTime(100);
    expect(state.plays).toBe(1);
    vi.advanceTimersByTime(5_000);
    expect(state.plays).toBe(1);
  });

  it("plays again when a reload lands between play() and its confirmation", () => {
    const { state, transport } = setup();
    transport.start();
    expect(state.plays).toBe(1);
    transport.reload(false);
    // A "playing" from the play before the reload does not count.
    transport.confirmPlaying();
    expect(transport.pending).toBe(true);
    transport.kick();
    transport.confirmPlaying();
    expect(transport.pending).toBe(true);
    vi.advanceTimersByTime(100);
    expect(state.plays).toBe(2);
    transport.confirmPlaying();
    expect(transport.pending).toBe(false);
  });

  it("drops a pending resume on cancel", () => {
    const { state, transport } = setup();
    transport.reload(true);
    transport.kick();
    transport.cancel();
    expect(transport.pending).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(state.plays).toBe(0);
    expect(state.changes).toEqual([true, false]);
  });

  it("gives up after 5 s when the player never becomes ready", () => {
    const { state, transport } = setup(false);
    transport.reload(true);
    transport.kick();
    vi.advanceTimersByTime(4_900);
    expect(transport.pending).toBe(true);
    vi.advanceTimersByTime(100);
    expect(transport.pending).toBe(false);
    state.ready = true;
    vi.advanceTimersByTime(5_000);
    expect(state.plays).toBe(0);
  });

  it("stops waiting for a confirmation that never comes", () => {
    const { state, transport } = setup();
    transport.start();
    vi.advanceTimersByTime(5_000);
    expect(transport.pending).toBe(false);
    expect(state.plays).toBe(1);
  });

  it("ignores everything once disposed", () => {
    const { state, transport } = setup();
    transport.reload(true);
    transport.kick();
    transport.dispose();
    vi.advanceTimersByTime(5_000);
    transport.start();
    transport.reload(true);
    transport.kick();
    vi.advanceTimersByTime(5_000);
    expect(state.plays).toBe(0);
    expect(transport.pending).toBe(false);
  });
});
