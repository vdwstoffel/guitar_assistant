import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_SPLIT,
  MIN_SPLIT,
  MAX_SPLIT,
  clampSplit,
  splitFromPointer,
  loadSplit,
  saveSplit,
} from "./splitPane";

/** A localStorage that can be made to misbehave the way real ones do. */
function installStorage(impl: Partial<Storage> = {}) {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
    ...impl,
  } as Storage;
  vi.stubGlobal("localStorage", store);
  return data;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clampSplit", () => {
  it("leaves a fraction inside the range alone", () => {
    expect(clampSplit(0.3)).toBe(0.3);
    expect(clampSplit(0.7)).toBe(0.7);
  });

  it("keeps the score pane from being squeezed out", () => {
    expect(clampSplit(0.98)).toBe(MAX_SPLIT);
  });

  it("keeps the transport controls from being crushed", () => {
    expect(clampSplit(0.01)).toBe(MIN_SPLIT);
  });

  it("falls back to an even split for values that are not numbers", () => {
    expect(clampSplit(Number.NaN)).toBe(DEFAULT_SPLIT);
    expect(clampSplit(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SPLIT);
    expect(clampSplit(null)).toBe(DEFAULT_SPLIT);
    expect(clampSplit(undefined)).toBe(DEFAULT_SPLIT);
    expect(clampSplit("two thirds")).toBe(DEFAULT_SPLIT);
  });

  it("accepts a numeric string, which is what localStorage hands back", () => {
    expect(clampSplit("0.4")).toBe(0.4);
  });
});

describe("splitFromPointer", () => {
  // The panes live inside a container that does not start at the left edge
  // of the window, so the pointer's position has to be measured against the
  // container's own rect rather than against clientX directly.
  const rect = { left: 200, width: 1000 };

  it("puts the divider where the pointer is", () => {
    expect(splitFromPointer(700, rect)).toBe(0.5);
    expect(splitFromPointer(500, rect)).toBe(0.3);
  });

  it("ignores the container's offset from the window edge", () => {
    expect(splitFromPointer(700, { left: 200, width: 1000 })).toBe(
      splitFromPointer(500, { left: 0, width: 1000 })
    );
  });

  it("clamps a drag past either end of the container", () => {
    expect(splitFromPointer(-400, rect)).toBe(MIN_SPLIT);
    expect(splitFromPointer(99999, rect)).toBe(MAX_SPLIT);
  });

  // A container that has not been laid out yet measures zero wide, and
  // dividing by that would hand back NaN and collapse the pane.
  it("falls back to an even split for a container with no width", () => {
    expect(splitFromPointer(700, { left: 200, width: 0 })).toBe(DEFAULT_SPLIT);
  });
});

describe("loadSplit", () => {
  it("returns the stored split", () => {
    installStorage().set("jamTracksSplit", "0.65");
    expect(loadSplit()).toBe(0.65);
  });

  it("returns an even split when nothing has been stored yet", () => {
    installStorage();
    expect(loadSplit()).toBe(DEFAULT_SPLIT);
  });

  it("ignores a stored value that is not a number", () => {
    installStorage().set("jamTracksSplit", "wide");
    expect(loadSplit()).toBe(DEFAULT_SPLIT);
  });

  // The clamp could tighten in a later version, and a value stored under the
  // old one should not be allowed to collapse a pane.
  it("clamps a stored value that is out of range", () => {
    installStorage().set("jamTracksSplit", "0.95");
    expect(loadSplit()).toBe(MAX_SPLIT);
  });

  it("survives a localStorage that throws, as in a private window", () => {
    installStorage({
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadSplit()).toBe(DEFAULT_SPLIT);
  });

  // Rendering happens on the server first, where there is no localStorage
  // at all and referencing it throws a ReferenceError rather than returning
  // undefined.
  it("survives there being no localStorage at all", () => {
    expect(loadSplit()).toBe(DEFAULT_SPLIT);
  });
});

describe("saveSplit", () => {
  it("stores the split so it survives a reload", () => {
    const data = installStorage();
    saveSplit(0.65);
    expect(data.get("jamTracksSplit")).toBe("0.65");
  });

  it("stores a clamped value, never a collapsed pane", () => {
    const data = installStorage();
    saveSplit(0.99);
    expect(data.get("jamTracksSplit")).toBe(String(MAX_SPLIT));
  });

  it("does not throw when storage is unavailable", () => {
    installStorage({
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => saveSplit(0.6)).not.toThrow();
  });
});

// The point of the feature: the balance you set while working the recording
// is the one you come back to, and it is reachable again from either end.
describe("setting the balance and coming back to it", () => {
  it("remembers a waveform-heavy split across a reload", () => {
    installStorage();

    // Drag the divider well to the right to work on the recording.
    const dragged = splitFromPointer(940, { left: 100, width: 1000 });
    expect(dragged).toBe(0.75);
    saveSplit(dragged);

    expect(loadSplit()).toBe(0.75);
  });

  it("comes back to even after a double-click reset", () => {
    installStorage();
    saveSplit(0.75);
    saveSplit(DEFAULT_SPLIT);
    expect(loadSplit()).toBe(DEFAULT_SPLIT);
  });
});
