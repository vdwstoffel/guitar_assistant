import { describe, expect, it } from "vitest";
import { emptyTabTex } from "../tabscore/emptyTab";
import { readTuningId, setTuning } from "../tabscore/commands/tuning";
import { SESSION_TUNING_IDS, tuningLabel, tuningMidi } from "./tunings";

describe("tuningMidi", () => {
  it("lists MIDI notes lowest string first", () => {
    expect(tuningMidi("standard")).toEqual([40, 45, 50, 55, 59, 64]);
    expect(tuningMidi("c-standard")).toEqual([36, 41, 46, 51, 55, 60]);
    expect(tuningMidi("drop-c")).toEqual([36, 43, 48, 53, 57, 62]);
    expect(tuningMidi("drop-c-sharp")).toEqual([37, 44, 49, 54, 58, 63]);
  });
  it("resolves every session tuning", () => {
    for (const id of SESSION_TUNING_IDS) {
      expect(tuningMidi(id)).toHaveLength(6);
      expect(tuningLabel(id)).toBeTruthy();
    }
  });
});

describe("new tuning presets", () => {
  it.each(["c-sharp-standard", "c-standard", "drop-c-sharp"])("%s round-trips through the editor", (id) => {
    expect(readTuningId(setTuning(emptyTabTex(120), id)!.text)).toBe(id);
  });
});
