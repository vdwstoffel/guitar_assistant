import { describe, expect, it } from "vitest";
import { dropUnknownRiffs, addRow, moveRow, parseLabel, reconcileRows, removeRow, riffOptionLabel, rowsToInput, shapeRows, updateRow, type Row } from "./songEdit";
import { SONG_SHAPE } from "./songs";
import type { SongSection } from "@/types";

const row = (key: string, over: Partial<Row> = {}): Row => ({ key, label: key, riffId: null, repeats: 1, riff: null, riffDeleted: false, ...over });

describe("songEdit", () => {
  it("moves a row and ignores moves off the ends", () => {
    const rows = [row("a"), row("b"), row("c")];
    expect(moveRow(rows, 0, 1).map((r) => r.key)).toEqual(["b", "a", "c"]);
    expect(moveRow(rows, 2, -1).map((r) => r.key)).toEqual(["a", "c", "b"]);
    expect(moveRow(rows, 0, -1).map((r) => r.key)).toEqual(["a", "b", "c"]);
    expect(moveRow(rows, 2, 1).map((r) => r.key)).toEqual(["a", "b", "c"]);
  });
  it("updates, removes and adds without mutating", () => {
    const rows = [row("a"), row("b")];
    expect(updateRow(rows, 1, { repeats: 4 })[1].repeats).toBe(4);
    expect(rows[1].repeats).toBe(1);
    expect(removeRow(rows, 0).map((r) => r.key)).toEqual(["b"]);
    expect(addRow(rows, "z")[2]).toMatchObject({ key: "z", label: "Section", repeats: 1, riffId: null });
  });
  it("builds the shape and the PUT body", () => {
    let n = 0;
    const rows = shapeRows(() => `k${n++}`);
    expect(rows.map((r) => r.label)).toEqual([...SONG_SHAPE]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    expect(rowsToInput([row("a", { riffId: "r1", repeats: 2 })])).toEqual([{ label: "a", riffId: "r1", repeats: 2 }]);
  });
  it("keeps keys by position when the server's copy comes back", () => {
    const riff = { id: "r1", name: "N", keyRoot: "E", scale: "Phrygian", tempo: 120, tsNum: 4, tsDen: 4, bars: 2 };
    const secs: SongSection[] = [
      { id: "s1", label: "Verse", repeats: 2, sortOrder: 0, riff },
      { id: "s2", label: "Chorus", repeats: 1, sortOrder: 1, riff: null },
    ];
    const out = reconcileRows([row("k0")], secs);
    expect(out.map((r) => r.key)).toEqual(["k0", "s2"]);
    expect(out[0]).toMatchObject({ riffId: "r1", repeats: 2 });
    expect(out[1].riffId).toBeNull();
  });
  it("notices a riff that was on screen and came back gone, and keeps saying so", () => {
    const riff = { id: "r1", name: "N", keyRoot: "E", scale: "Phrygian", tempo: 120, tsNum: 4, tsDen: 4, bars: 2 };
    const gone: SongSection[] = [{ id: "s1", label: "V", repeats: 1, sortOrder: 0, riff: null }];
    const first = reconcileRows([row("k0", { riffId: "r1", riff })], gone);
    expect(first[0].riffDeleted).toBe(true);
    expect(reconcileRows(first, gone)[0].riffDeleted).toBe(true);
    expect(reconcileRows([row("k0")], gone)[0].riffDeleted).toBe(false);
  });
  it("labels picker options and validates labels", () => {
    expect(riffOptionLabel({ name: "Gallop", keyRoot: "E", scale: "Phrygian", tempo: 120 })).toBe("Gallop · E Phrygian · ♩120");
    expect(riffOptionLabel({ name: "Idea", keyRoot: "E", scale: "Minor", tempo: null })).toBe("Idea · E Minor · no tempo yet");
    expect(parseLabel("  Verse ")).toBe("Verse");
    expect(parseLabel("  ")).toBeNull();
    expect(parseLabel("x".repeat(41))).toBeNull();
  });
  it("drops riff ids that are gone and keeps the user's edit", () => {
    const riff = { id: "r1", name: "N", keyRoot: "E", scale: "Phrygian", tempo: 120, tsNum: 4, tsDen: 4, bars: 2 };
    const rows = [row("a", { label: "Edited", riffId: "r1", riff }), row("b", { riffId: "r2", riff: { ...riff, id: "r2" } }), row("c")];
    const out = dropUnknownRiffs(rows, new Set(["r2"]));
    expect(out[0]).toMatchObject({ label: "Edited", riffId: null, riff: null, riffDeleted: true });
    expect(out[1]).toBe(rows[1]);
    expect(out[2].riffDeleted).toBe(false);
  });
});
