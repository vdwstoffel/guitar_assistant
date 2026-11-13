import { describe, expect, it } from "vitest";
import { readTuningId, setTuning } from "../tabscore/commands/tuning";
import { BASS_TUNING_PRESETS, bassTuningFor } from "./bassTunings";
import { SESSION_TUNING_IDS, tuningLabel, tuningMidi } from "./tunings";

/** An empty four-string tab, as a bass part's will be. */
const BASS_TAB = "\\tuning g2 d2 a1 e1\n\\tempo 120\n.\nr r r r\n";

describe("BASS_TUNING_PRESETS", () => {
  it("lists one bass tuning per session tuning, in the session's order", () => {
    expect(BASS_TUNING_PRESETS.map((p) => p.id)).toEqual([
      "bass-standard",
      "bass-half-down",
      "bass-full-down",
      "bass-c-sharp-standard",
      "bass-c-standard",
      "bass-drop-d",
      "bass-drop-c-sharp",
      "bass-drop-c",
    ]);
  });

  it("has E standard bass as E1 A1 D2 G2", () => {
    expect(tuningMidi("bass-standard")).toEqual([28, 33, 38, 43]);
  });

  it.each(SESSION_TUNING_IDS)("is the %s guitar's four low strings an octave down, under the same name", (id) => {
    const bass = bassTuningFor(id);
    expect(tuningMidi(bass)).toEqual(tuningMidi(id).slice(0, 4).map((n) => n - 12));
    expect(tuningLabel(bass)).toBe(tuningLabel(id));
  });

  it.each(BASS_TUNING_PRESETS.map((p) => p.id))("%s round-trips through the editor on a four-string tab", (id) => {
    expect(readTuningId(setTuning(BASS_TAB, id)!.text)).toBe(id);
  });
});

describe("bassTuningFor", () => {
  it("gives the bass tuning that matches the guitar's", () => {
    expect(bassTuningFor("standard")).toBe("bass-standard");
    expect(bassTuningFor("c-standard")).toBe("bass-c-standard");
    expect(bassTuningFor("drop-c-sharp")).toBe("bass-drop-c-sharp");
  });

  it("maps every session tuning to its own bass tuning", () => {
    expect(SESSION_TUNING_IDS.map(bassTuningFor)).toEqual(BASS_TUNING_PRESETS.map((p) => p.id));
  });

  it("falls back to E standard bass for a tuning it has no bass for", () => {
    expect(bassTuningFor("open-g")).toBe("bass-standard");
    expect(bassTuningFor("not-a-tuning")).toBe("bass-standard");
    expect(bassTuningFor("")).toBe("bass-standard");
  });
});
