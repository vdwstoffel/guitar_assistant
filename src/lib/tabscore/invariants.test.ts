/* eslint-disable @typescript-eslint/no-explicit-any --
 * The locality invariant reads alphaTab's model, whose types are only
 * reachable through namespaces that cannot be imported as types.
 */
import { describe, it, expect } from "vitest";
import { parseTex } from "./parse";
import { setFret, clearNote } from "./commands/setFret";
import { scaleDuration, toggleDotted } from "./commands/duration";
import { insertBeat, deleteBeat, addBar, deleteBar } from "./commands/structure";
import { toggleTechnique } from "./commands/technique";
import { makeRest } from "./commands/rest";
import { fixBar, fixAllBars } from "./commands/fixBar";
import { barState } from "./barFill";
import { type CommandResult, type EditOutcome } from "./apply";
import { beatSpliceRange, type Caret } from "./locate";
import { sliceCp } from "./offsets";

// Bar/beat shape is 2 bars, 3 + 2 = 5 beats — several invariants below depend
// on that exact count staying put. CARET's own beat (bar 0 / beat 0) carries
// "{tu 3}", a beat-level triplet marker unrelated to any command's own job:
// it sits after the duration suffix, so it is unambiguously the BEAT's
// effects (see parseBeatText's doc comment), not the note's.
const DOC = '\\title "Riff \u{1F3B8}"\n\\tempo 120\n.\n// verse\n3.6.8{tu 3}   5.6 7.6 | 7.6.4 r.4\n';
const CARET: Caret = { barIndex: 0, beatIndex: 0, string: 6 };

/** An outcome's result when the command acted, else null — the older commands' shape. */
const accepted = (outcome: EditOutcome): CommandResult | null => (outcome.kind === "ok" ? outcome.result : null);

const COMMANDS: Array<[string, (t: string, c: Caret) => CommandResult | null]> = [
  ["setFret", (t, c) => setFret(t, c, 9)],
  ["clearNote", (t, c) => clearNote(t, c)],
  ["scaleDuration/halve", (t, c) => scaleDuration(t, c, "halve")],
  ["scaleDuration/double", (t, c) => scaleDuration(t, c, "double")],
  ["toggleDotted", (t, c) => toggleDotted(t, c)],
  ["insertBeat", (t, c) => insertBeat(t, c)],
  ["deleteBeat", (t, c) => deleteBeat(t, c)],
  ["addBar", (t, c) => addBar(t, c)],
  ["deleteBar", (t, c) => deleteBar(t, c)],
  ["toggleTechnique", (t, c) => toggleTechnique(t, c, "hammer")],
  ["makeRest", (t, c) => accepted(makeRest(t, c))],
  // On the bar after the caret's: DOC's bar 0 — a lone triplet 8th among
  // plain ones — is a bar no rest can complete, which fixBar refuses (see
  // fixBar.test.ts). Bar 1, short by a half, it fixes.
  ["fixBar", (t, c) => accepted(fixBar(t, { ...c, barIndex: c.barIndex + 1 }))],
];

describe("the invariant fixtures are not vacuous", () => {
  // Every command below must genuinely act on DOC at CARET, not reject it —
  // otherwise the "re-parses cleanly" and "header preserved" blocks below
  // would pass by having nothing to check, silently testing nothing.
  for (const [name, run] of COMMANDS) {
    it(`${name} performs a real edit on DOC`, () => {
      expect(run(DOC, CARET), name).not.toBeNull();
    });
  }
});

describe("invariant: every command's output re-parses cleanly", () => {
  for (const [name, run] of COMMANDS) {
    it(name, () => {
      const out = run(DOC, CARET);
      if (out === null) return; // a rejected command leaves the document alone
      expect(parseTex(out.text).ok).toBe(true);
    });
  }
});

describe("invariant: the document header is preserved byte-for-byte", () => {
  // Everything up to the track separator is untouched by note-level edits,
  // including the non-BMP title and the comment.
  const HEADER = '\\title "Riff \u{1F3B8}"\n\\tempo 120\n.\n// verse\n';

  for (const [name, run] of COMMANDS) {
    it(name, () => {
      const out = run(DOC, CARET);
      if (out === null) return;
      expect(out.text.startsWith(HEADER)).toBe(true);
    });
  }
});

describe("invariant: text after the spliced range is preserved", () => {
  // CARET targets bar 0 / beat 0, so HEADER (above) ends exactly where every
  // edit begins — startsWith alone can never catch corruption AFTER the
  // edited beat, which is exactly the bug class Task 8 produced (dangling
  // pipes, orphaned spaces). DOC's triple space at "3.6.8   5.6" exists to
  // probe this: a splice that eats one space too many or too few shows up
  // here, not above.
  const TAIL = "   5.6 7.6 | 7.6.4 r.4\n";

  // Commands that rewrite beat 0 in place — or insert immediately after it,
  // pushing the rest of the line along unchanged — must leave everything
  // from the triple space onward byte-identical. deleteBeat, addBar,
  // deleteBar and fixBar legitimately change what follows (that is their
  // job), and scaleDuration re-pins the beat after the one it edits (pinned
  // exactly below), so they are deliberately excluded.
  const IN_PLACE = [
    "setFret",
    "clearNote",
    "toggleDotted",
    "toggleTechnique",
    "insertBeat",
    "makeRest",
  ];

  for (const [name, run] of COMMANDS) {
    if (!IN_PLACE.includes(name)) continue;
    it(name, () => {
      const out = run(DOC, CARET);
      if (out === null) return;
      expect(out.text.endsWith(TAIL), name).toBe(true);
    });
  }

  it("scaleDuration changes the beat it edits and pins the next one's duration, nothing else", () => {
    const head = '\\title "Riff \u{1F3B8}"\n\\tempo 120\n.\n// verse\n';
    expect(scaleDuration(DOC, CARET, "halve")!.text).toBe(`${head}3.6.16{tu 3}   5.6.8 7.6 | 7.6.4 r.4\n`);
    expect(scaleDuration(DOC, CARET, "double")!.text).toBe(`${head}3.6.4{tu 3}   5.6.8 7.6 | 7.6.4 r.4\n`);
  });
});

describe("invariant: every command preserves a beat-level effect it does not own", () => {
  // CARET's beat carries "{tu 3}" (a triplet marker) unrelated to any single
  // command's job. A command must never destroy a beat-level effect it isn't
  // the one editing — the exact bug class toggleDotted had: it replaced
  // beat.effects wholesale ("{d}") instead of editing its token list, so a
  // beat that was simultaneously dotted-toggled AND part of a triplet lost
  // the triplet. deleteBeat and deleteBar legitimately remove the beat (and,
  // for deleteBar, the whole bar) as part of their job, so "tu 3" is not
  // expected to survive either of those and they are excluded below.
  const REMOVES_THE_BEAT = ["deleteBeat", "deleteBar"];

  for (const [name, run] of COMMANDS) {
    if (REMOVES_THE_BEAT.includes(name)) continue;
    it(name, () => {
      const out = run(DOC, CARET);
      if (out === null) return; // a rejected command leaves the document alone
      expect(out.text, name).toContain("tu 3");
    });
  }
});

describe("regression: beatSpliceRange never reaches a separator", () => {
  // Task 3's review confirmed these paths correct by direct execution against
  // alphaTab 1.8.1, but the suite did not pin them. They are the exact cases the
  // whitespace trim exists for, so a parser change must not regress them silently.
  const TEX = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n";

  it("stops before a bar-boundary pipe", () => {
    const { scoreNode } = parseTex(TEX);
    const r = beatSpliceRange(TEX, scoreNode, { barIndex: 0, beatIndex: 2, string: 6 })!;
    expect(sliceCp(TEX, r.cpStart, r.cpEnd)).toBe("7.6");
    expect(sliceCp(TEX, r.cpStart, r.cpEnd)).not.toContain("|");
  });

  it("stops before the trailing newline on the last beat of the document", () => {
    const { scoreNode } = parseTex(TEX);
    const r = beatSpliceRange(TEX, scoreNode, { barIndex: 1, beatIndex: 1, string: 6 })!;
    expect(sliceCp(TEX, r.cpStart, r.cpEnd)).toBe("r.4");
  });

  it("handles a document with no trailing newline", () => {
    const bare = "\\tempo 120\n.\n3.6.8 5.6";
    const { scoreNode } = parseTex(bare);
    const r = beatSpliceRange(bare, scoreNode, { barIndex: 0, beatIndex: 1, string: 6 })!;
    expect(sliceCp(bare, r.cpStart, r.cpEnd)).toBe("5.6");
    expect(r.cpEnd).toBeGreaterThanOrEqual(r.cpStart);
  });
});

describe("regression: duration inheritance and dotted round-trip", () => {
  // Task 7's review confirmed these by hand-trace but the suite did not pin them.
  it("inherits a duration across a bar boundary", () => {
    // Only bar 0 beat 0 carries an explicit duration; the caret sits in bar 1.
    const tex = "\\tempo 120\n.\n3.6.16 5.6 7.6 | 7.6 r\n";
    const r = scaleDuration(tex, { barIndex: 1, beatIndex: 0, string: 6 }, "double")!;
    expect(r.text).toContain("7.6.8");
  });

  it("inherits a duration past an intervening rest", () => {
    const tex = "\\tempo 120\n.\n3.6.16 r 7.6 | 7.6.4 r.4\n";
    const r = scaleDuration(tex, { barIndex: 0, beatIndex: 2, string: 6 }, "double")!;
    expect(r.text).toContain("7.6.8");
  });

  it("returns a beat to its exact original text after toggling dotted twice", () => {
    const tex = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n";
    const caret = { barIndex: 0, beatIndex: 0, string: 6 };
    const once = toggleDotted(tex, caret)!;
    expect(once.text).toContain("3.6.8{d}");
    expect(toggleDotted(once.text, caret)!.text).toBe(tex);
  });
});

describe("invariant: every command refuses to act on unparseable text", () => {
  const BROKEN = "\\tempo 120\n.\n(((\n";

  for (const [name, run] of COMMANDS) {
    it(name, () => {
      expect(run(BROKEN, CARET), name).toBeNull();
    });
  }
});

describe("invariant: a rejected command returns null and never a corrupted document", () => {
  it("out-of-range caret is rejected by every caret-dependent command", () => {
    const bad: Caret = { barIndex: 99, beatIndex: 99, string: 6 };
    for (const [name, run] of COMMANDS) {
      const out = run(DOC, bad);
      if (name === "addBar") {
        // addBar ignores the caret by design; its output must still parse.
        expect(parseTex(out!.text).ok, name).toBe(true);
      } else {
        expect(out, name).toBeNull();
      }
    }
  });
});

describe("invariant: an edit changes no length outside the beats it edits", () => {
  // The property "bars that stay correct" exists for. Lengths are alphaTab's
  // own reading of every beat (duration, dots, tuplet, grace), compared
  // before and after each command at every beat of every fixture.
  const CORPUS = [
    "3.6.4 5.6 7.6 8.6 | 3.6.8 r r r r r r r",
    "3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 8.6 | 3.6 5.6 7.6 8.6 3.6 5.6 7.6 8.6",
    "3.6.4 r r r | 5.6.4 5.6 r r | r.2 7.6.8 r r r",
    "3.6.8{tu 3} 5.6.8{tu 3} 7.6.8{tu 3} r.4 r.2 | 3.6.4{d} 5.6.8 r.2",
    "5.6.4 -.6 r r | -.6.8 7.6{h} 9.6 r r.4 r.4",
    "3.6.16 5.6 7.6 8.6 r.4 r.2 | 3.6.2 5.6.2 7.6.4 | (0.6 2.5).8 r r r",
    // Broken bars, for fixBar and Fix all. A bar no rest can complete (a lone
    // triplet 8th among plain ones, which they refuse) beside one they fix:
    "3.6.8{tu 3} 5.6 7.6 | 7.6.4 r.4",
    // A short bar and a long one, each followed by a bar that inherits its last
    // duration, so the fix must re-pin it; the cut also removes the note the
    // next bar's tie was holding:
    "3.6.4 5.6.8 7.6.4 | 8.6 r r r | 3.6.4 5.6 7.6 8.6 9.6.8 | -.6 r r r r r r r",
    // A long bar fixed by cutting its last note short (a whole note becomes a
    // half and an 8th rest), before a bar that inherits the whole note and ties to it:
    "3.6.4 5.6.8 7.6.1 | -.6 | 3.6.4 5.6 7.6 8.6",
    // A bar the commands refuse to read (a dead note) between two they fix:
    "3.6.4 5.6 | x.6.4 5.6 | 3.6.4 5.6 7.6 8.6 9.6",
    // A length marker on a note with no duration of its own, which makeRest and clearNote must keep:
    "3.6{d} 5.6.8 r.4 7.6.4 | 3.6{tu 3} 5.6{tu 3} 7.6{tu 3} r.2",
  ]
    .map((body) => `\\tempo 120\n.\n${body}\n`)
    .concat("\\tempo 120\n\\ts 3 4\n.\n3.6.4 5.6 7.6 | 3.6.8 r r r r r | 3.6.2 r.8 r\n");

  type Beat = { length: string; rest: boolean };
  const read = (text: string): Beat[][] =>
    parseTex(text).score.tracks[0].staves[0].bars.map((bar: any) =>
      bar.voices[0].beats.map((b: any) => ({
        // A grace beat takes no time, and alphaTab recomputes its duration from its neighbours.
        length: b.graceType > 0 ? `grace/${b.graceType}` : `${b.duration}/${b.dots}/${b.tupletNumerator}/${b.tupletDenominator}`,
        rest: b.isRest,
      })),
    );
  const lengths = (beats: Beat[]) => beats.map((b) => b.length);

  /** Every bar but the caret's is unchanged. */
  const othersUnchanged = (before: Beat[][], after: Beat[][], barIndex: number) => {
    expect(after.length).toBe(before.length);
    before.forEach((bar, i) => {
      if (i !== barIndex) expect(lengths(after[i]), `bar ${i}`).toEqual(lengths(bar));
    });
  };

  /**
   * In the caret's bar, what comes before the caret and everything from the
   * first note after it are unchanged; between them, the edited beat and the
   * rests its edit may take along or absorb.
   */
  const localInBar = (before: Beat[], after: Beat[], beatIndex: number) => {
    expect(lengths(after.slice(0, beatIndex))).toEqual(lengths(before.slice(0, beatIndex)));
    const firstNote = before.findIndex((b, i) => i > beatIndex && !b.rest);
    if (firstNote === -1) return;
    expect(lengths(after.slice(after.length - (before.length - firstNote)))).toEqual(lengths(before.slice(firstNote)));
  };

  const local = (before: Beat[][], after: Beat[][], c: Caret) => {
    othersUnchanged(before, after, c.barIndex);
    localInBar(before[c.barIndex], after[c.barIndex], c.beatIndex);
  };
  const nothingMoves = (before: Beat[][], after: Beat[][]) => expect(after.map(lengths)).toEqual(before.map(lengths));

  const CASES: Array<{
    name: string;
    run: (t: string, c: Caret) => CommandResult | null;
    /** `text` is the command's output, `input` the document it ran on. */
    check: (before: Beat[][], after: Beat[][], c: Caret, text: string, input: string) => void;
  }> = [
    { name: "scaleDuration/halve", run: (t, c) => scaleDuration(t, c, "halve"), check: local },
    { name: "scaleDuration/double", run: (t, c) => scaleDuration(t, c, "double"), check: local },
    { name: "toggleDotted", run: toggleDotted, check: local },
    { name: "makeRest", run: (t, c) => accepted(makeRest(t, c)), check: nothingMoves },
    { name: "clearNote", run: clearNote, check: nothingMoves },
    {
      name: "deleteBeat",
      run: deleteBeat,
      check: (before, after, c) => {
        othersUnchanged(before, after, c.barIndex);
        expect(lengths(after[c.barIndex])).toEqual(lengths(before[c.barIndex].filter((_, i) => i !== c.beatIndex)));
      },
    },
    {
      name: "deleteBar",
      run: deleteBar,
      check: (before, after, c) => expect(after.map(lengths)).toEqual(before.filter((_, i) => i !== c.barIndex).map(lengths)),
    },
    {
      name: "addBar",
      run: addBar,
      check: (before, after, _c, text) => {
        expect(after.slice(0, -1).map(lengths)).toEqual(before.map(lengths));
        expect(barState(parseTex(text).score, after.length - 1).kind).toBe("exact");
      },
    },
    {
      // …and fixBar either makes the bar exact or refuses.
      name: "fixBar",
      run: (t, c) => accepted(fixBar(t, c)),
      check: (before, after, c, text) => {
        othersUnchanged(before, after, c.barIndex);
        expect(barState(parseTex(text).score, c.barIndex).kind).toBe("exact");
      },
    },
    {
      // Fix all is a fixBar per broken bar. The bars it fixes add up — as
      // many as it says it fixed — and every other bar keeps every beat's
      // length: one that already added up, and one it skipped (as many
      // as it says it skipped), whatever was done to the bars around it.
      name: "fixAllBars",
      run: (t, c) => fixAllBars(t, c).result,
      check: (before, after, c, text, input) => {
        expect(after.length).toBe(before.length);
        const was = parseTex(input).score;
        const now = parseTex(text).score;
        let fixed = 0;
        let skipped = 0;
        before.forEach((bar, i) => {
          if (!["short", "long"].includes(barState(was, i).kind)) {
            expect(lengths(after[i]), `bar ${i} was not broken`).toEqual(lengths(bar));
          } else if (barState(now, i).kind === "exact") {
            fixed++;
          } else {
            skipped++;
            expect(lengths(after[i]), `bar ${i} was skipped`).toEqual(lengths(bar));
            expect(fixBar(input, { ...c, barIndex: i }).kind, `bar ${i} was skipped, so fixBar alone refuses it`).toBe("refused");
          }
        });
        const said = fixAllBars(input, c);
        expect({ fixed, skipped }, "bars fixed and skipped, as reported").toEqual({ fixed: said.fixed, skipped: said.skipped });
      },
    },
  ];

  for (const { name, run, check } of CASES) {
    it(name, () => {
      let acted = 0;
      for (const text of CORPUS) {
        const before = read(text);
        before.forEach((bar, barIndex) =>
          bar.forEach((_, beatIndex) => {
            const caret: Caret = { barIndex, beatIndex, string: 6 };
            const out = run(text, caret);
            if (!out) return;
            acted++;
            try {
              check(before, read(out.text), caret, out.text, text);
            } catch (error) {
              const where = `${name} at bar ${barIndex} beat ${beatIndex} of ${JSON.stringify(text)}`;
              throw new Error(`${where}\n${(error as Error).message}`, { cause: error });
            }
          }),
        );
      }
      expect(acted, `${name} acted at least once`).toBeGreaterThan(0);
    });
  }
});
