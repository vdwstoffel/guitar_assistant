import { describe, expect, it } from "vitest";
import { createLyricsHolder } from "./heldLyrics";

describe("createLyricsHolder", () => {
  it("holds a song's text until the next pad for it takes it", () => {
    const h = createLyricsHolder();
    expect(h.peek("a")).toBeNull();
    h.hold("a", "verse one");
    expect(h.peek("a")).toBe("verse one");
    expect(h.peek("b")).toBeNull();
    expect(h.take("a")).toBe("verse one");
    expect(h.take("a")).toBeNull();
  });

  it("a later hold for the same song replaces the text", () => {
    const h = createLyricsHolder();
    h.hold("a", "one");
    h.hold("a", "one two");
    expect(h.peek("a")).toBe("one two");
  });

  it("a landed save lets go only of the text it saved", () => {
    const h = createLyricsHolder();
    h.hold("a", "newer");
    h.release("a", "older"); // an earlier save landing late
    expect(h.peek("a")).toBe("newer");
    h.release("a", "newer");
    expect(h.peek("a")).toBeNull();
  });

  it("says when it starts and stops holding anything (the page's leave guard)", () => {
    const calls: boolean[] = [];
    const h = createLyricsHolder((holding) => calls.push(holding));
    h.hold("a", "x");
    h.hold("b", "y");
    h.hold("a", "x2");
    expect(calls).toEqual([true]);
    h.release("a", "x2");
    expect(calls).toEqual([true]);
    h.take("b");
    expect(calls).toEqual([true, false]);
    h.release("b", "y"); // nothing held: no change
    h.take("b");
    expect(calls).toEqual([true, false]);
  });
});
