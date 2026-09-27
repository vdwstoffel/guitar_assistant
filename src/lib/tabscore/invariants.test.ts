import { describe, it, expect } from "vitest";
import { parseTex } from "./parse";
import { setFret, clearNote } from "./commands/setFret";
import { scaleDuration, toggleDotted } from "./commands/duration";
import { insertBeat, deleteBeat, addBar, deleteBar } from "./commands/structure";
import { toggleTechnique } from "./commands/technique";
import { type CommandResult } from "./apply";
import { beatSpliceRange, type Caret } from "./locate";
import { sliceCp } from "./offsets";

// Bar/beat shape is 2 bars, 3 + 2 = 5 beats — several invariants below depend
// on that exact count staying put. CARET's own beat (bar 0 / beat 0) carries
// "{tu 3}", a beat-level triplet marker unrelated to any command's own job:
// it sits after the duration suffix, so it is unambiguously the BEAT's
// effects (see parseBeatText's doc comment), not the note's.
const DOC = '\\title "Riff \u{1F3B8}"\n\\tempo 120\n.\n// verse\n3.6.8{tu 3}   5.6 7.6 | 7.6.4 r.4\n';
const CARET: Caret = { barIndex: 0, beatIndex: 0, string: 6 };

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
  // from the triple space onward byte-identical. deleteBeat, addBar and
  // deleteBar legitimately change what follows (that is their job), so they
  // are deliberately excluded.
  const IN_PLACE = [
    "setFret",
    "clearNote",
    "scaleDuration/halve",
    "scaleDuration/double",
    "toggleDotted",
    "toggleTechnique",
    "insertBeat",
  ];

  for (const [name, run] of COMMANDS) {
    if (!IN_PLACE.includes(name)) continue;
    it(name, () => {
      const out = run(DOC, CARET);
      if (out === null) return;
      expect(out.text.endsWith(TAIL), name).toBe(true);
    });
  }
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
