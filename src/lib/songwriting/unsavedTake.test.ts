import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEAVE_TAKE_QUESTION,
  captureEscapeAction,
  guardUnsavedTake,
  hasUnsavedTake,
  linkLeavesView,
  mayLeaveTake,
} from "./unsavedTake";

describe("captureEscapeAction", () => {
  const esc = (targetTag: string | null, extra: object = {}) => ({ key: "Escape", targetTag, ...extra });

  it("leaves Escape in a box to the box", () => {
    for (const tag of ["INPUT", "SELECT", "TEXTAREA", "input"]) expect(captureEscapeAction(esc(tag), false)).toBe("field");
  });
  it("asks before discarding anywhere else in the panel", () => {
    for (const tag of ["BODY", "DIV", "BUTTON", null]) expect(captureEscapeAction(esc(tag), false)).toBe("ask-discard");
  });
  it("does nothing while saving, for a held key, mid-composition, or for other keys", () => {
    expect(captureEscapeAction(esc("BODY"), true)).toBeNull();
    expect(captureEscapeAction(esc("BODY", { repeat: true }), false)).toBeNull();
    expect(captureEscapeAction(esc("INPUT", { isComposing: true }), false)).toBeNull();
    expect(captureEscapeAction({ key: "Enter", targetTag: "BODY" }, false)).toBeNull();
  });
});

describe("linkLeavesView", () => {
  const here = "https://localhost/songs?view=write";
  const plain = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
  const link = (href: string, extra: object = {}) => ({ href, target: "", download: false, ...extra });

  it("counts a plain click to another page of the app", () => {
    expect(linkLeavesView(plain, link("/songs?view=riffs"), here)).toBe(true);
    expect(linkLeavesView(plain, link("https://localhost/songs?view=riffs&riff=1"), here)).toBe(true);
    expect(linkLeavesView(plain, link("/lessons"), here)).toBe(true);
  });
  it("ignores the same page and a jump within it", () => {
    expect(linkLeavesView(plain, link(here), here)).toBe(false);
    expect(linkLeavesView(plain, link("/songs?view=write#top"), here)).toBe(false);
  });
  it("ignores clicks that open another tab, downloads, and other sites", () => {
    for (const k of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) expect(linkLeavesView({ ...plain, [k]: true }, link("/lessons"), here)).toBe(false);
    expect(linkLeavesView({ ...plain, button: 1 }, link("/lessons"), here)).toBe(false);
    expect(linkLeavesView({ ...plain, defaultPrevented: true }, link("/lessons"), here)).toBe(false);
    expect(linkLeavesView(plain, link("/lessons", { target: "_blank" }), here)).toBe(false);
    expect(linkLeavesView(plain, link("/lessons", { target: "_self" }), here)).toBe(true);
    expect(linkLeavesView(plain, link("/api/x.ogg", { download: true }), here)).toBe(false);
    expect(linkLeavesView(plain, link("https://example.com/"), here)).toBe(false);
  });
});

describe("the unsaved-take guard", () => {
  const g = globalThis as unknown as { window?: unknown; document?: unknown };
  afterEach(() => {
    delete g.window;
    delete g.document;
  });
  const fakeDom = () => {
    g.window = new EventTarget();
    g.document = new EventTarget();
  };

  it("asks only while a take is unsaved", () => {
    fakeDom();
    const ask = vi.fn(() => false);
    expect(hasUnsavedTake()).toBe(false);
    expect(mayLeaveTake(ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();

    const release = guardUnsavedTake();
    expect(hasUnsavedTake()).toBe(true);
    expect(mayLeaveTake(ask)).toBe(false);
    expect(ask).toHaveBeenCalledWith(LEAVE_TAKE_QUESTION);
    expect(mayLeaveTake(() => true)).toBe(true);

    release();
    release(); // twice is harmless
    expect(hasUnsavedTake()).toBe(false);
  });

  it("a remount's late cleanup does not clear a newer guard", () => {
    fakeDom();
    const first = guardUnsavedTake();
    const second = guardUnsavedTake();
    first();
    expect(hasUnsavedTake()).toBe(true);
    second();
    expect(hasUnsavedTake()).toBe(false);
  });

  it("makes the page ask before unloading", () => {
    fakeDom();
    const release = guardUnsavedTake();
    const e = new Event("beforeunload", { cancelable: true });
    (g.window as EventTarget).dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    release();
    const after = new Event("beforeunload", { cancelable: true });
    (g.window as EventTarget).dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
