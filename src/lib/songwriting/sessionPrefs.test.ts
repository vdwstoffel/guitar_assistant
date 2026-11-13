import { describe, expect, it } from "vitest";
import { DEFAULT_SESSION, parseSessionPrefs, recordingClick, serializeSessionPrefs } from "./sessionPrefs";

describe("session prefs", () => {
  it("falls back to defaults", () => {
    expect(parseSessionPrefs(null)).toEqual(DEFAULT_SESSION);
    expect(parseSessionPrefs("{not json")).toEqual(DEFAULT_SESSION);
  });

  it("drops what a session kept while it had a groove", () => {
    const old = parseSessionPrefs('{"keyRoot":"D","grooveId":"builtin:gallop","tempo":150,"hearChords":true}');
    expect(old).toEqual({ ...DEFAULT_SESSION, keyRoot: "D" });
  });

  it("keeps the click's tempo, time signature and switch", () => {
    const p = parseSessionPrefs('{"clickTempo":132,"tsNum":7,"tsDen":8,"click":false}');
    expect(p).toMatchObject({ clickTempo: 132, tsNum: 7, tsDen: 8, click: false });
    expect(DEFAULT_SESSION).toMatchObject({ clickTempo: null, tsNum: 4, tsDen: 4, click: true });
  });

  it("records to the click only with a tempo and the click on", () => {
    expect(recordingClick({ ...DEFAULT_SESSION, clickTempo: 140, tsNum: 3, tsDen: 4 })).toEqual({ tempo: 140, tsNum: 3, tsDen: 4 });
    expect(recordingClick({ ...DEFAULT_SESSION, clickTempo: 140, click: false })).toBeNull();
    expect(recordingClick({ ...DEFAULT_SESSION, clickTempo: null })).toBeNull();
  });

  it("drops a click tempo out of range and a time signature it does not offer", () => {
    expect(parseSessionPrefs('{"clickTempo":5}').clickTempo).toBeNull();
    expect(parseSessionPrefs('{"clickTempo":120.4}').clickTempo).toBeNull();
    expect(parseSessionPrefs('{"tsNum":9,"tsDen":4}')).toMatchObject({ tsNum: 4, tsDen: 4 });
  });

  it("cleans the progression", () => {
    const raw = JSON.stringify({
      progression: [
        { root: "A", quality: "Minor", bars: 0 },
        { root: "H", quality: "Minor", bars: 1 },
        { root: "C", quality: "Weird", bars: 1 },
      ],
    });
    expect(parseSessionPrefs(raw).progression).toEqual([{ root: "A", quality: "Minor", bars: 1 }]);
  });

  it("rejects unknown scales and tunings", () => {
    expect(parseSessionPrefs('{"scale":"None"}').scale).toBe("Minor");
    expect(parseSessionPrefs('{"scale":"Dorian"}').scale).toBe("Dorian");
    // Inherited keys are not scales (they would crash the theory functions).
    expect(parseSessionPrefs('{"scale":"constructor"}').scale).toBe("Minor");
    expect(parseSessionPrefs('{"scale":"toString"}').scale).toBe("Minor");
    expect(parseSessionPrefs('{"scale":"__proto__"}').scale).toBe("Minor");
    expect(parseSessionPrefs('{"tuning":"banjo"}').tuning).toBe("standard");
  });

  it("round-trips", () => {
    const p = {
      ...DEFAULT_SESSION, keyRoot: "D", labelMode: "notes" as const,
      progression: [{ root: "D", quality: "Minor" as const, bars: 2 }],
    };
    expect(parseSessionPrefs(serializeSessionPrefs(p))).toEqual(p);
  });
});
