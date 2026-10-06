import { describe, it, expect, beforeEach } from "vitest";
import {
  focusPlayer,
  focusedPlayer,
  registerPlayer,
  isPlayerRegistered,
  subscribeToPlayerFocus,
  keyboardOwner,
  resetPlayerFocus,
} from "./playerFocus";

beforeEach(() => resetPlayerFocus());

describe("registration", () => {
  it("starts with nothing registered and nothing focused", () => {
    expect(isPlayerRegistered("tab")).toBe(false);
    expect(focusedPlayer()).toBeNull();
  });

  it("knows a player once it registers, and forgets it on release", () => {
    const release = registerPlayer("tab");
    expect(isPlayerRegistered("tab")).toBe(true);
    release();
    expect(isPlayerRegistered("tab")).toBe(false);
  });

  it("stays registered until the last holder releases", () => {
    // React mounts the next owner before unmounting the last, so the count
    // has to survive an overlap rather than being a boolean.
    const first = registerPlayer("tab");
    const second = registerPlayer("tab");
    first();
    expect(isPlayerRegistered("tab")).toBe(true);
    second();
    expect(isPlayerRegistered("tab")).toBe(false);
  });

  it("ignores a release called twice", () => {
    const a = registerPlayer("tab");
    const b = registerPlayer("tab");
    a();
    a();
    expect(isPlayerRegistered("tab")).toBe(true);
    b();
    expect(isPlayerRegistered("tab")).toBe(false);
  });

  it("does not move the focus when a player appears", () => {
    // Showing the tab should not take the keyboard off the audio; clicking
    // into it is what does that.
    registerPlayer("tab");
    expect(focusedPlayer()).toBeNull();
  });

  it("drops the focus when the focused player goes away", () => {
    const release = registerPlayer("tab");
    focusPlayer("tab");
    release();
    expect(focusedPlayer()).toBeNull();
  });

  it("leaves the focus alone when a different player goes away", () => {
    registerPlayer("tab");
    const audio = registerPlayer("audio");
    focusPlayer("tab");
    audio();
    expect(focusedPlayer()).toBe("tab");
  });
});

describe("subscribeToPlayerFocus", () => {
  it("tells subscribers when the focus moves", () => {
    let calls = 0;
    subscribeToPlayerFocus(() => calls++);
    focusPlayer("tab");
    expect(calls).toBe(1);
  });

  it("says nothing when the focus is set to what it already was", () => {
    focusPlayer("tab");
    let calls = 0;
    subscribeToPlayerFocus(() => calls++);
    focusPlayer("tab");
    expect(calls).toBe(0);
  });

  it("tells subscribers when a player appears or goes away", () => {
    let calls = 0;
    subscribeToPlayerFocus(() => calls++);
    const release = registerPlayer("tab");
    expect(calls).toBe(1);
    release();
    expect(calls).toBe(2);
  });

  it("stops after unsubscribing", () => {
    let calls = 0;
    const off = subscribeToPlayerFocus(() => calls++);
    off();
    focusPlayer("tab");
    expect(calls).toBe(0);
  });
});

describe("keyboardOwner", () => {
  it("gives the keys to nobody while something on top has claimed them", () => {
    // The tab editor and the lessons tab modal open OVER the page; they
    // handle their own keys and the players behind stand down.
    expect(
      keyboardOwner({ exclusiveClaim: true, focused: "audio", tabRegistered: true }),
    ).toBe("none");
    expect(
      keyboardOwner({ exclusiveClaim: true, focused: null, tabRegistered: false }),
    ).toBe("none");
  });

  it("gives them to the audio when no tab is on screen", () => {
    // The overwhelmingly common case: a jam track, or any other section.
    // Nothing about it should change.
    expect(
      keyboardOwner({ exclusiveClaim: false, focused: null, tabRegistered: false }),
    ).toBe("audio");
    expect(
      keyboardOwner({ exclusiveClaim: false, focused: "tab", tabRegistered: false }),
    ).toBe("audio");
  });

  it("starts on the audio when a tab appears but has not been clicked into", () => {
    expect(
      keyboardOwner({ exclusiveClaim: false, focused: null, tabRegistered: true }),
    ).toBe("audio");
  });

  it("follows the player that was clicked into last", () => {
    expect(
      keyboardOwner({ exclusiveClaim: false, focused: "tab", tabRegistered: true }),
    ).toBe("tab");
    expect(
      keyboardOwner({ exclusiveClaim: false, focused: "audio", tabRegistered: true }),
    ).toBe("audio");
  });
});
