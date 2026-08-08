import { describe, it, expect } from "vitest";
import { retryAsync } from "./retry";

describe("retryAsync", () => {
  it("returns the result on the first successful attempt", async () => {
    let calls = 0;
    const result = await retryAsync(async () => { calls++; return "ok"; }, 3);
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries after failures and succeeds on a later attempt", async () => {
    let calls = 0;
    const result = await retryAsync(async () => {
      calls++;
      if (calls < 3) throw new Error(`fail ${calls}`);
      return "recovered";
    }, 3);
    expect(result).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("throws the last error after exhausting all attempts", async () => {
    let calls = 0;
    await expect(
      retryAsync(async () => { calls++; throw new Error(`fail ${calls}`); }, 3)
    ).rejects.toThrow("fail 3");
    expect(calls).toBe(3);
  });

  it("makes exactly one attempt when attempts is 1 (no retry)", async () => {
    let calls = 0;
    await expect(
      retryAsync(async () => { calls++; throw new Error("boom"); }, 1)
    ).rejects.toThrow("boom");
    expect(calls).toBe(1);
  });

  it("invokes onRetry before each retry but not after the final failure", async () => {
    const retries: number[] = [];
    await expect(
      retryAsync(async () => { throw new Error("x"); }, 3, {
        onRetry: (_err, attempt) => retries.push(attempt),
      })
    ).rejects.toThrow("x");
    // Retries happen after attempts 1 and 2, not after the final (3rd) attempt.
    expect(retries).toEqual([1, 2]);
  });
});
