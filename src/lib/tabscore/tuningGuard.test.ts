/* eslint-disable @typescript-eslint/no-explicit-any -- alphaTab AST interop (parse.ts convention). */
import { describe, it, expect } from "vitest";
import * as alphaTabModule from "@coderline/alphatab";
import { parseTex } from "./parse";
import { ensureRenderableTuning } from "./tuningGuard";

const alphaTab = alphaTabModule as any;

const importScore = (tex: string) => {
  const r = parseTex(tex);
  expect(r.ok).toBe(true);
  return r.score;
};

describe("ensureRenderableTuning", () => {
  it("fills the standard tuning for a tab-only score with bare-pitch notes and no tuning line", () => {
    // The exact shape that used to blank the canvas: bare e3/g3-style notes,
    // no \tuning. alphaTab imports these with empty staff.tuning and
    // string/fret -1; the tab renderer then crashes on group.staves[0].
    const score = importScore(
      "\\tempo 100\n.\nr r r r| e3 g3 b3 a3 | e5 g5 b5 a5 |\n",
    );
    const staff = score.tracks[0].staves[0];
    expect(staff.tuning.length).toBe(0);

    ensureRenderableTuning(alphaTab, score);

    expect(staff.tuning.length).toBeGreaterThan(0);
    for (const bar of staff.bars) {
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          for (const note of beat.notes ?? []) {
            expect(note.string).toBeGreaterThanOrEqual(1);
            expect(note.string).toBeLessThanOrEqual(staff.tuning.length);
            expect(note.fret).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it("places bare pitches on the nearest string at the lowest fret", () => {
    // e3 = MIDI 52. Standard tuning open strings (string 1..6): 64/59/55/50/45/40.
    // 52 sits 2 frets above the open D (string 4) — the nearest placement.
    const score = importScore("\\tempo 100\n.\ne3|\n");
    ensureRenderableTuning(alphaTab, score);
    const notes: any[] = [];
    for (const bar of score.tracks[0].staves[0].bars) {
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          notes.push(...(beat.notes ?? []));
        }
      }
    }
    expect(notes.length).toBe(1);
    expect(notes[0].string).toBe(4);
    expect(notes[0].fret).toBe(2);
  });

  it("leaves a staff that already has a tuning untouched", () => {
    const score = importScore(
      "\\tempo 100\n\\tuning(e4 b3 g3 d3 a2 e2)\n.\n3.6 5.6|\n",
    );
    const staff = score.tracks[0].staves[0];
    const before = [...staff.tuning];
    ensureRenderableTuning(alphaTab, score);
    expect(staff.tuning).toEqual(before);
  });

  it("leaves fret.string notes untouched even when the tuning had to be filled", () => {
    // `.` + 3.6 auto-fills tuning in alphaTab itself; guard must no-op.
    const score = importScore("\\tempo 100\n.\nr r r r| 3.6 5.6 7.6 8.6 |\n");
    const staff = score.tracks[0].staves[0];
    expect(staff.tuning.length).toBe(6);
    const note = staff.bars[1].voices[0].beats[0].notes[0];
    const before = { string: note.string, fret: note.fret };
    ensureRenderableTuning(alphaTab, score);
    expect(note.string).toBe(before.string);
    expect(note.fret).toBe(before.fret);
  });

  it("survives the empty-tab template (rest bars only)", () => {
    const score = importScore("\\tempo 120\n.\nr r r r\n");
    ensureRenderableTuning(alphaTab, score); // must not throw
    expect(score.tracks[0].staves[0].bars.length).toBeGreaterThanOrEqual(1);
  });

  it("handles a bass-range bare-pitch tab", () => {
    // Low pitches (e2=40..g3=55) still land on some default tuning's strings
    // at fret >= 0; which preset wins matters less than every note getting
    // a legal placement so the tab renderer can staff the bar.
    const score = importScore("\\tempo 100\n.\ne2 a2 d3 g3|\n");
    ensureRenderableTuning(alphaTab, score);
    const staff = score.tracks[0].staves[0];
    expect(staff.tuning.length).toBeGreaterThan(0);
    for (const voice of staff.bars[0].voices) {
      for (const beat of voice.beats) {
        for (const note of beat.notes ?? []) {
          expect(note.fret).toBeGreaterThanOrEqual(0);
          expect(note.string).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("places even out-of-range pitches so the tab renderer cannot crash", () => {
    // e7 = MIDI 100: fret 36 on the high e — beyond the comfortable band,
    // but a legal placement is mandatory (string -1 crashes collectSpaces).
    const score = importScore("\\tempo 100\n.\ne7|\n");
    ensureRenderableTuning(alphaTab, score);
    const staff = score.tracks[0].staves[0];
    const notes: any[] = [];
    for (const bar of staff.bars)
      for (const voice of bar.voices)
        for (const beat of voice.beats) notes.push(...(beat.notes ?? []));
    expect(notes.length).toBe(1);
    expect(notes[0].string).toBeGreaterThanOrEqual(1);
    expect(notes[0].string).toBeLessThanOrEqual(staff.tuning.length);
    expect(notes[0].fret).toBeGreaterThanOrEqual(0);
  });

  it("survives a score with no tracks/staves/bars at all", () => {
    ensureRenderableTuning(alphaTab, { tracks: [] });
    ensureRenderableTuning(alphaTab, { tracks: [{ staves: [] }] });
    ensureRenderableTuning(alphaTab, null);
    ensureRenderableTuning(alphaTab, undefined);
  });
});
