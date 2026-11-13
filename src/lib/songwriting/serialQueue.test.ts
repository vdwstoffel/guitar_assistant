import { describe, expect, it } from "vitest";
import { createKeyedQueues, createSerialQueue } from "./serialQueue";

/** A promise the test resolves or rejects by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createSerialQueue", () => {
  it("starts a job only after the one before it has settled", async () => {
    const q = createSerialQueue();
    const log: string[] = [];
    const first = deferred<string>();
    const a = q.run(async () => {
      log.push("a starts");
      return first.promise;
    });
    const b = q.run(async () => {
      log.push("b starts");
      return "b";
    });
    await flush();
    expect(log).toEqual(["a starts"]);
    first.resolve("a");
    expect(await a).toBe("a");
    expect(await b).toBe("b");
    expect(log).toEqual(["a starts", "b starts"]);
  });

  it("hands responses back in the order the jobs were queued, however long each takes", async () => {
    const q = createSerialQueue();
    const order: number[] = [];
    const slow = deferred<number>();
    const p1 = q.run(() => slow.promise).then((v) => order.push(v));
    const p2 = q.run(async () => 2).then((v) => order.push(v));
    setTimeout(() => slow.resolve(1), 5);
    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  it("keeps going after a job fails, and the failure reaches only that job's caller", async () => {
    const q = createSerialQueue();
    const failed = q.run(async () => {
      throw new Error("nope");
    });
    const next = q.run(async () => "ok");
    await expect(failed).rejects.toThrow("nope");
    expect(await next).toBe("ok");
  });

  it("is idle once every job queued so far has settled", async () => {
    const q = createSerialQueue();
    const gate = deferred<void>();
    let done = false;
    void q.run(() => gate.promise).then(() => {
      done = true;
    });
    let idle = false;
    void q.idle().then(() => {
      idle = true;
    });
    await flush();
    expect(idle).toBe(false);
    gate.resolve();
    await q.idle();
    expect(done).toBe(true);
    expect(idle).toBe(true);
  });

  it("is idle at once when nothing was queued", async () => {
    await expect(createSerialQueue().idle()).resolves.toBeUndefined();
  });
});

describe("createKeyedQueues", () => {
  it("serialises jobs per key but lets different keys run side by side", async () => {
    const qs = createKeyedQueues();
    const log: string[] = [];
    const gate = deferred<void>();
    void qs.run("a", async () => {
      log.push("a1");
      await gate.promise;
    });
    void qs.run("a", async () => {
      log.push("a2");
    });
    void qs.run("b", async () => {
      log.push("b1");
    });
    await flush();
    expect(log).toEqual(["a1", "b1"]);
    gate.resolve();
    await qs.idle("a");
    expect(log).toEqual(["a1", "b1", "a2"]);
  });

  it("drops a key's queue once it drains, and idle() of an unknown key resolves", async () => {
    const qs = createKeyedQueues();
    await qs.run("a", async () => 1);
    await flush();
    expect(qs.size).toBe(0);
    await expect(qs.idle("never")).resolves.toBeUndefined();
  });

  it("waits for a job queued under a key before reporting it idle", async () => {
    const qs = createKeyedQueues();
    const gate = deferred<void>();
    const seen: string[] = [];
    void qs.run("riff", async () => {
      await gate.promise;
      seen.push("saved");
    });
    const idle = qs.idle("riff").then(() => seen.push("idle"));
    await flush();
    expect(seen).toEqual([]);
    gate.resolve();
    await idle;
    expect(seen).toEqual(["saved", "idle"]);
  });
});
