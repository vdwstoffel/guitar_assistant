import { describe, it, expect, vi, afterEach } from "vitest";
import { routeAlphaTabOutput, shouldApplySink } from "./audioSink";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shouldApplySink", () => {
  const output = {};

  it("routes an output it has not routed before", () => {
    expect(shouldApplySink(null, output, "default")).toBe(true);
  });

  it("skips the same output and preference — playerReady fires several times per edit", () => {
    expect(shouldApplySink({ output, pref: "default" }, output, "default")).toBe(false);
  });

  it("routes again when the preference changes", () => {
    expect(shouldApplySink({ output, pref: "default" }, output, "spk-2")).toBe(true);
  });

  it("routes a new output object, as after the editor re-mounts", () => {
    expect(shouldApplySink({ output, pref: "default" }, {}, "default")).toBe(true);
  });

  it("has nothing to route before the output exists", () => {
    expect(shouldApplySink(null, undefined, "default")).toBe(false);
    expect(shouldApplySink(null, null, "default")).toBe(false);
  });
});

describe("routeAlphaTabOutput", () => {
  it("never falls back to alphaTab's API when the output has a context without setSinkId", async () => {
    const output = {
      context: { destination: {} },
      setOutputDevice: vi.fn(async () => {}),
      enumerateOutputDevices: vi.fn(async () => []),
    };
    await routeAlphaTabOutput(output, "spk-2");
    expect(output.setOutputDevice).not.toHaveBeenCalled();
    expect(output.enumerateOutputDevices).not.toHaveBeenCalled();
  });

  it("sets the sink on the output's own AudioContext, never through alphaTab's API", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const setSinkId = vi.fn(async (_id: string) => {});
    const output = {
      context: { setSinkId, destination: {} },
      setOutputDevice: vi.fn(async () => {}),
      enumerateOutputDevices: vi.fn(async () => []),
    };
    await routeAlphaTabOutput(output, "spk-2");
    expect(setSinkId).toHaveBeenCalledWith("spk-2");
    // alphaTab's setOutputDevice/enumerateOutputDevices each create an
    // AudioContext they never close — the leak this exists to avoid.
    expect(output.setOutputDevice).not.toHaveBeenCalled();
    expect(output.enumerateOutputDevices).not.toHaveBeenCalled();
  });

  it("falls back to alphaTab's API for an output without a context", async () => {
    const output = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setOutputDevice: vi.fn(async (_device: unknown) => {}),
      enumerateOutputDevices: vi.fn(async () => []),
    };
    await routeAlphaTabOutput(output, "default");
    expect(output.setOutputDevice).toHaveBeenCalledWith(null);
  });

  it("does nothing, quietly, for no output at all — and that counts as applied", async () => {
    await expect(routeAlphaTabOutput(undefined, "default")).resolves.toBe(true);
  });

  it("resolves true once the context's setSinkId has applied the device", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const setSinkId = vi.fn(async (_id: string) => {});
    const output = { context: { setSinkId, destination: {} } };
    await expect(routeAlphaTabOutput(output, "spk-2")).resolves.toBe(true);
  });

  it("resolves false, still with its warning, when setSinkId rejects — a headset that is not connected yet", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failure = new DOMException("no such device", "NotFoundError");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const setSinkId = vi.fn(async (_id: string) => {
      throw failure;
    });
    const output = { context: { setSinkId, destination: {} } };
    await expect(routeAlphaTabOutput(output, "headset")).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith("AudioContext.setSinkId failed", failure);
  });

  it("counts a context the browser cannot route as applied: retrying would change nothing", async () => {
    const output = { context: { destination: {} } };
    await expect(routeAlphaTabOutput(output, "spk-2")).resolves.toBe(true);
  });

  it("resolves true for the fallback when alphaTab's setOutputDevice applies the device", async () => {
    const output = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setOutputDevice: vi.fn(async (_device: unknown) => {}),
      enumerateOutputDevices: vi.fn(async () => [{ deviceId: "spk-2" }]),
    };
    await expect(routeAlphaTabOutput(output, "spk-2")).resolves.toBe(true);
    expect(output.setOutputDevice).toHaveBeenCalledWith({ deviceId: "spk-2" });
  });

  it("resolves false for the fallback when alphaTab's setOutputDevice rejects", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const output = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setOutputDevice: vi.fn(async (_device: unknown) => {
        throw new Error("no such device");
      }),
      enumerateOutputDevices: vi.fn(async () => []),
    };
    await expect(routeAlphaTabOutput(output, "default")).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
