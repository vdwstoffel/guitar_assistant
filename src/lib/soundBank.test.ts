import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SOUND_BANKS,
  DEFAULT_SOUND_BANK_ID,
  soundBankById,
  getSoundBankPreference,
  setSoundBankPreference,
  subscribeToSoundBankChanges,
  getServerSoundBank,
} from "./soundBank";

let storage: Map<string, string>;
let listeners: Map<string, Set<(event: Event) => void>>;

beforeEach(() => {
  storage = new Map();
  listeners = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  });
  vi.stubGlobal("window", {
    addEventListener: (type: string, fn: (event: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: (event: Event) => void) => {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent: (event: Event) => {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
      return true;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("soundBankById", () => {
  it("finds each bank by its id", () => {
    for (const bank of SOUND_BANKS) {
      expect(soundBankById(bank.id)).toBe(bank);
    }
  });

  it("falls back to the default bank for an unknown or missing id", () => {
    const fallback = soundBankById(DEFAULT_SOUND_BANK_ID);
    expect(soundBankById("nonsense")).toBe(fallback);
    expect(soundBankById(null)).toBe(fallback);
    expect(soundBankById(undefined)).toBe(fallback);
  });

  it("every bank has a distinct id and a /soundfont/ url", () => {
    const ids = new Set(SOUND_BANKS.map((b) => b.id));
    expect(ids.size).toBe(SOUND_BANKS.length);
    for (const bank of SOUND_BANKS) {
      expect(bank.url.startsWith("/soundfont/")).toBe(true);
      expect(bank.url.endsWith(".sf2")).toBe(true);
    }
  });
});

describe("preference", () => {
  it("defaults when nothing is stored", () => {
    expect(getSoundBankPreference()).toBe(DEFAULT_SOUND_BANK_ID);
    expect(getServerSoundBank()).toBe(DEFAULT_SOUND_BANK_ID);
  });

  it("reads back a stored bank", () => {
    setSoundBankPreference(SOUND_BANKS[1].id);
    expect(getSoundBankPreference()).toBe(SOUND_BANKS[1].id);
  });

  it("normalizes a stored id that no longer names a bank", () => {
    storage.set("guitar-assistant.soundBank", "retired-bank");
    expect(getSoundBankPreference()).toBe(DEFAULT_SOUND_BANK_ID);
  });

  it("stores the normalized id, never a raw one", () => {
    setSoundBankPreference("nonsense");
    expect(storage.get("guitar-assistant.soundBank")).toBe(DEFAULT_SOUND_BANK_ID);
  });
});

describe("subscribeToSoundBankChanges", () => {
  it("receives the id a change announces, and unsubscribes", () => {
    const seen: string[] = [];
    const off = subscribeToSoundBankChanges((id) => seen.push(id));
    setSoundBankPreference(SOUND_BANKS[2].id);
    expect(seen).toEqual([SOUND_BANKS[2].id]);
    off();
    setSoundBankPreference(SOUND_BANKS[1].id);
    expect(seen).toEqual([SOUND_BANKS[2].id]);
  });
});
