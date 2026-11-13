import { describe, expect, it } from "vitest";
import { createOnePlayerGroup, takeKeyAction } from "./onePlayer";

describe("createOnePlayerGroup", () => {
  it("pauses every other member when one starts, never the one starting", () => {
    const paused: string[] = [];
    const group = createOnePlayerGroup();
    const take = group.join(() => paused.push("take"));
    const tab = group.join(() => paused.push("tab"));
    take.started();
    expect(paused).toEqual(["tab"]);
    tab.started();
    expect(paused).toEqual(["tab", "take"]);
  });

  it("leaves a member that has left alone", () => {
    const paused: string[] = [];
    const group = createOnePlayerGroup();
    const take = group.join(() => paused.push("take"));
    const tab = group.join(() => paused.push("tab"));
    tab.leave();
    take.started();
    expect(paused).toEqual([]);
  });

  it("does nothing for a member on its own", () => {
    const paused: string[] = [];
    const take = createOnePlayerGroup().join(() => paused.push("take"));
    take.started();
    expect(paused).toEqual([]);
  });

  it("keeps groups apart", () => {
    const paused: string[] = [];
    const a = createOnePlayerGroup();
    const b = createOnePlayerGroup();
    const inA = a.join(() => paused.push("a"));
    b.join(() => paused.push("b"));
    inA.started();
    expect(paused).toEqual([]);
  });

  it("copes with a member leaving while the others are being paused", () => {
    const group = createOnePlayerGroup();
    const paused: string[] = [];
    const take = group.join(() => paused.push("take"));
    const tab: { leave(): void } = group.join(() => {
      paused.push("tab");
      tab.leave();
    });
    group.join(() => paused.push("third"));
    take.started();
    expect(paused).toEqual(["tab", "third"]);
  });
});

describe("takeKeyAction", () => {
  const key = (over: Partial<Parameters<typeof takeKeyAction>[0]> = {}) => ({
    key: " ",
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...over,
  });

  it("toggles the take on plain Space", () => {
    expect(takeKeyAction(key())).toBe("toggle");
  });

  it("swallows a held Space's repeats", () => {
    expect(takeKeyAction(key({ repeat: true }))).toBe("swallow");
  });

  it("leaves Space with a modifier, and every other key, alone", () => {
    for (const mod of ["ctrlKey", "metaKey", "altKey", "shiftKey"] as const) {
      expect(takeKeyAction(key({ [mod]: true })), mod).toBeNull();
    }
    expect(takeKeyAction(key({ key: "Enter" }))).toBeNull();
    expect(takeKeyAction(key({ key: "k" }))).toBeNull();
  });
});
