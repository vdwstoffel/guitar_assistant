import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getMix,
  setMix,
  getServerMix,
  subscribeMix,
  metronomeVolumeOf,
  countInVolumeOf,
  DEFAULT_MIX,
} from "./mixPrefs";

const KEY = "tabEditorMix";

/** A localStorage that can be made to misbehave the way real ones do. */
function installStorage(impl: Partial<Storage> = {}) {
  const data = new Map<string, string>();
  const store: Storage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
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

/**
 * A module instance whose cached snapshot has not been taken yet, so it
 * reads the localStorage the test just installed. The module caches on
 * purpose (useSyncExternalStore needs a stable snapshot), which is exactly
 * what has to be defeated here.
 */
async function freshModule() {
  vi.resetModules();
  return import("./mixPrefs");
}

beforeEach(() => {
  installStorage();
  // The module caches its snapshot; a write resets it, which is how each
  // test starts from a known state without reloading the module.
  setMix(DEFAULT_MIX);
});

describe("the snapshot", () => {
  it("is referentially stable between writes", () => {
    // useSyncExternalStore re-renders forever if this is not true.
    expect(getMix()).toBe(getMix());
  });

  it("changes identity on a write, so React sees it", () => {
    const before = getMix();
    setMix({ ...before, volume: 0.5 });
    expect(getMix()).not.toBe(before);
    expect(getMix().volume).toBe(0.5);
  });

  it("gives the defaults on the server, where nothing is stored", () => {
    expect(getServerMix()).toEqual(DEFAULT_MIX);
  });
});

describe("subscribers", () => {
  it("are told about a write and can unsubscribe", () => {
    const seen = vi.fn();
    const off = subscribeMix(seen);
    setMix({ ...getMix(), volume: 0.2 });
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    setMix({ ...getMix(), volume: 0.3 });
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe("reading back what was stored", () => {
  it("round-trips through localStorage", async () => {
    setMix({ volume: 0.4, metronome: 0.8, metronomeOn: true, countIn: true });
    const raw = localStorage.getItem(KEY)!;
    expect(JSON.parse(raw)).toEqual({
      volume: 0.4,
      metronome: 0.8,
      metronomeOn: true,
      countIn: true,
    });
  });

  it("clamps a stored volume that is out of range", async () => {
    installStorage();
    localStorage.setItem(KEY, JSON.stringify({ volume: 9, metronome: -1, metronomeOn: true }));
    const mod = await freshModule();
    expect(mod.getMix().volume).toBe(1);
    // Never zero: the toggle owns off, and a zero would leave the slider
    // with nothing to restore.
    expect(mod.getMix().metronome).toBe(0.05);
  });

  it("falls back to the defaults on junk", async () => {
    installStorage();
    localStorage.setItem(KEY, "not json at all");
    const mod = await freshModule();
    expect(mod.getMix()).toEqual(DEFAULT_MIX);
  });

  it("survives a localStorage that throws, as a private window's does", async () => {
    installStorage({
      getItem: () => {
        throw new DOMException("denied");
      },
      setItem: () => {
        throw new DOMException("denied");
      },
    });
    const mod = await freshModule();
    expect(mod.getMix()).toEqual(DEFAULT_MIX);
    // A write must not take the editor down with it.
    expect(() => mod.setMix({ ...DEFAULT_MIX, volume: 0.1 })).not.toThrow();
    expect(mod.getMix().volume).toBe(0.1);
  });
});

const mix = (patch: Partial<typeof DEFAULT_MIX> = {}) => ({ ...DEFAULT_MIX, ...patch });

describe("metronomeVolumeOf", () => {
  it("is zero when off — alphaTab has no separate enable", () => {
    expect(metronomeVolumeOf(mix({ metronome: 0.7, metronomeOn: false }))).toBe(0);
  });

  it("is the chosen level when on", () => {
    expect(metronomeVolumeOf(mix({ metronome: 0.7, metronomeOn: true }))).toBe(0.7);
  });
});

describe("countInVolumeOf", () => {
  it("is zero when off", () => {
    expect(countInVolumeOf(mix({ metronome: 0.7, countIn: false }))).toBe(0);
  });

  it("is audible even with the metronome switched off", () => {
    // Counting yourself in and then playing to silence is a normal way to
    // practise, so this must not read through metronomeVolumeOf.
    expect(countInVolumeOf(mix({ metronome: 0.7, metronomeOn: false, countIn: true }))).toBe(0.7);
  });

  it("shares the metronome's level — one click, one slider", () => {
    expect(countInVolumeOf(mix({ metronome: 0.3, metronomeOn: true, countIn: true }))).toBe(0.3);
  });
});

describe("the stored shape", () => {
  it("gives an absent count-in the default rather than the opposite of it", () => {
    // Prefs written before the count-in existed are still in people's
    // browsers. A missing flag must not reach alphaTab as undefined, and
    // must not silently come out as off when the default is on.
    installStorage();
    localStorage.setItem(KEY, JSON.stringify({ volume: 0.5, metronome: 0.6, metronomeOn: true }));
    return freshModule().then((mod) => {
      expect(mod.getMix().countIn).toBe(DEFAULT_MIX.countIn);
      expect(mod.getMix().countIn).toBe(true);
    });
  });

  it("still honours a count-in that was deliberately switched off", () => {
    installStorage();
    localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_MIX, countIn: false }));
    return freshModule().then((mod) => {
      expect(mod.getMix().countIn).toBe(false);
      expect(mod.countInVolumeOf(mod.getMix())).toBe(0);
    });
  });
});
