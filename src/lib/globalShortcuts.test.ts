import { describe, it, expect } from "vitest";
import { claimGlobalShortcuts, globalShortcutsClaimed } from "./globalShortcuts";

describe("globalShortcuts", () => {
  it("is unclaimed when nothing is open", () => {
    expect(globalShortcutsClaimed()).toBe(false);
  });

  it("is claimed while an owner holds it, and free once it lets go", () => {
    const release = claimGlobalShortcuts();
    expect(globalShortcutsClaimed()).toBe(true);
    release();
    expect(globalShortcutsClaimed()).toBe(false);
  });

  it("stays claimed while the next owner mounts before the last unmounts", () => {
    // Strict Mode double-invokes effects, and a dialog can hand over to
    // another, so the two overlap. A boolean would be cleared by whichever
    // left first, handing the keyboard back with an owner still on screen.
    const first = claimGlobalShortcuts();
    const second = claimGlobalShortcuts();
    first();
    expect(globalShortcutsClaimed()).toBe(true);
    second();
    expect(globalShortcutsClaimed()).toBe(false);
  });

  it("ignores a release called twice", () => {
    // An effect cleanup can run more than once in development.
    const a = claimGlobalShortcuts();
    const b = claimGlobalShortcuts();
    a();
    a();
    expect(globalShortcutsClaimed()).toBe(true);
    b();
    expect(globalShortcutsClaimed()).toBe(false);
  });

  it("never goes negative, so a later claim still registers", () => {
    const stray = claimGlobalShortcuts();
    stray();
    stray();
    expect(globalShortcutsClaimed()).toBe(false);
    const release = claimGlobalShortcuts();
    expect(globalShortcutsClaimed()).toBe(true);
    release();
  });
});
