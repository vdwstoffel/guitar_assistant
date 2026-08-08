import { describe, it, expect } from "vitest";
import { createConcurrencyQueue } from "./queue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("createConcurrencyQueue", () => {
  it("never runs more than `limit` tasks at once", async () => {
    const queue = createConcurrencyQueue(2);
    let active = 0;
    let maxActive = 0;
    const gates = [deferred(), deferred(), deferred(), deferred()];

    const runs = gates.map((gate) =>
      queue.add(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await gate.promise;
        active--;
      })
    );

    // Let the queue start whatever it can (limit = 2).
    await Promise.resolve();
    expect(maxActive).toBe(2);

    // Release tasks one at a time; total concurrency must never exceed 2.
    for (const gate of gates) {
      gate.resolve();
      await Promise.resolve();
    }
    await Promise.all(runs);
    expect(maxActive).toBe(2);
  });

  it("propagates task rejection to its add() promise without stalling the queue", async () => {
    const queue = createConcurrencyQueue(1);
    await expect(queue.add(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    let ran = false;
    await queue.add(async () => { ran = true; });
    expect(ran).toBe(true);
  });
});
