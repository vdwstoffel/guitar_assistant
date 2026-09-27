import { describe, it, expect } from "vitest";
import { toggleTechnique, TECHNIQUE_KEYS } from "./technique";

const TEX = "\\tempo 120\n.\n3.6.8 5.6\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

describe("toggleTechnique", () => {
  it("adds a hammer-on to the note at the caret", () => {
    expect(toggleTechnique(TEX, at(0, 0), "hammer")!.text).toContain("3.6{h}.8");
  });

  it("removes the technique when applied twice", () => {
    const once = toggleTechnique(TEX, at(0, 0), "hammer")!;
    const twice = toggleTechnique(once.text, at(0, 0), "hammer")!;
    expect(twice.text).toBe(TEX);
  });

  it("writes a full bend with bend points", () => {
    expect(toggleTechnique(TEX, at(0, 0), "bendFull")!.text).toContain("{b (0 4)}");
  });

  it("writes a half bend", () => {
    expect(toggleTechnique(TEX, at(0, 0), "bendHalf")!.text).toContain("{b (0 2)}");
  });

  it("writes a bend-release", () => {
    expect(toggleTechnique(TEX, at(0, 0), "bendRelease")!.text).toContain("{b (0 4 0)}");
  });

  it("writes a pre-bend", () => {
    expect(toggleTechnique(TEX, at(0, 0), "preBend")!.text).toContain("{b (4 4)}");
  });

  it("treats every bend preset as the same toggle slot", () => {
    // All four write a `b` token, so applying one then another replaces rather
    // than stacking two bends on one note.
    const full = toggleTechnique(TEX, at(0, 0), "bendFull")!;
    const swapped = toggleTechnique(full.text, at(0, 0), "bendFull")!;
    expect(swapped.text).toBe(TEX);
  });

  it("returns null when there is no note on the caret's string", () => {
    expect(toggleTechnique(TEX, at(0, 0, 1), "hammer")).toBeNull();
  });

  it("maps keyboard keys to techniques", () => {
    expect(TECHNIQUE_KEYS.h).toBe("hammer");
    expect(TECHNIQUE_KEYS.p).toBe("palmMute");
    expect(TECHNIQUE_KEYS.x).toBe("dead");
  });
});

// Regressions found while verifying the brief's tokens and beatText.ts's
// note/beat-effect split against the real alphaTab parser (see
// task-9-report.md). Not in the original brief; added because each pins a
// defect that the tests above cannot reach — every one above happens to
// target a note that already has an explicit duration suffix, and none of
// them apply a technique inside a chord.
describe("toggleTechnique: regressions beyond the brief's fixtures", () => {
  it("attaches the effect to a note with no explicit duration suffix, not to the beat", () => {
    // Beat 1 ("5.6") has no ".N" duration of its own — it inherits one. A
    // trailing "{h}" with nothing between it and the note is ambiguous for a
    // naive "strip the last brace as the beat's" parser: it would misfile
    // the note's own effect as the beat's, silently losing it on toggle-off
    // (a different code path is exercised beneath, since re-parsing then
    // finds no note left carrying "h" to remove).
    const once = toggleTechnique(TEX, at(0, 1), "hammer")!;
    expect(once.text).toBe("\\tempo 120\n.\n3.6.8 5.6{h}\n");
    const twice = toggleTechnique(once.text, at(0, 1), "hammer")!;
    expect(twice.text).toBe(TEX);
  });

  it("applies a technique to one note of a chord without disturbing the other", () => {
    const tex = "\\tempo 120\n.\n(3.6 5.5).8\n";
    const once = toggleTechnique(tex, at(0, 0), "hammer")!;
    expect(once.text).toBe("\\tempo 120\n.\n(3.6{h} 5.5).8\n");
    const twice = toggleTechnique(once.text, at(0, 0), "hammer")!;
    expect(twice.text).toBe(tex);
  });

  it("applies a bend to one note of a chord (bend args nest parens inside the chord's own)", () => {
    const tex = "\\tempo 120\n.\n(3.6 5.5).8\n";
    const once = toggleTechnique(tex, at(0, 0), "bendFull")!;
    expect(once.text).toBe("\\tempo 120\n.\n(3.6{b (0 4)} 5.5).8\n");
    const twice = toggleTechnique(once.text, at(0, 0), "bendFull")!;
    expect(twice.text).toBe(tex);
  });

  it("writes the left-hand-tap token, not the beat-level bass-tap token", () => {
    // "tt" parses, but only as a BEAT property (bass slap/pop/tap); it is
    // absent from alphaTab's note-property table, so it would silently
    // re-target the whole beat instead of this note. "lht" is the real
    // per-note tap (note.isLeftHandTapped).
    const once = toggleTechnique(TEX, at(0, 0), "tap")!;
    expect(once.text).toContain("3.6{lht}.8");
    const twice = toggleTechnique(once.text, at(0, 0), "tap")!;
    expect(twice.text).toBe(TEX);
  });
});

// Round 2: issues raised in code review of the commit above, each confirmed
// against the committed code before being fixed (see task-9-fix-report.md).
describe("toggleTechnique: code review round 2", () => {
  it("replaces one bend preset with another rather than removing it", () => {
    // F2: all four bend presets share head "b", so the naive "same head
    // found -> remove" toggle logic deleted the bend outright on the second
    // call instead of swapping it, contradicting the comment above (and the
    // test above it, which only ever toggles the SAME preset twice — an
    // ordinary toggle-off that can't distinguish "remove" from "replace").
    const full = toggleTechnique(TEX, at(0, 0), "bendFull")!;
    expect(full.text).toContain("{b (0 4)}");
    const half = toggleTechnique(full.text, at(0, 0), "bendHalf")!;
    expect(half.text).toContain("{b (0 2)}");
    expect(half.text).not.toContain("{b (0 4)}");
  });

  it("keeps a token's own bare-number argument when an unrelated token in the same block is toggled", () => {
    // F3: the harmonic family (ah/th/ph/sh/fh) takes an unparenthesised
    // fret-offset argument, e.g. "{ah 12}". The old tokenizer only kept a
    // parenthesised argument list attached to its token; a bare trailing
    // number fell through as a separate (bogus) token and was silently
    // dropped the next time formatEffects re-joined the list.
    const tex = "\\tempo 120\n.\n3.6{ah 12}.8 5.6\n";
    const once = toggleTechnique(tex, at(0, 0), "hammer")!;
    expect(once.text).toBe("\\tempo 120\n.\n3.6{ah 12 h}.8 5.6\n");
    const twice = toggleTechnique(once.text, at(0, 0), "hammer")!;
    expect(twice.text).toBe(tex);
  });

  it("round-trips a beat carrying a note effect, a duration, AND a beat effect together", () => {
    // The seam the beatText.ts redesign introduced: note-effects, duration,
    // and beat-effects are three independently-optional groups in one
    // regex per beat shape. Pin all three present at once.
    const tex = "\\tempo 120\n.\n3.6.8{d} 5.6\n";
    const once = toggleTechnique(tex, at(0, 0), "hammer")!;
    expect(once.text).toBe("\\tempo 120\n.\n3.6{h}.8{d} 5.6\n");
    const twice = toggleTechnique(once.text, at(0, 0), "hammer")!;
    expect(twice.text).toBe(tex);
  });

  it("adds a technique to a note that already carries an unrelated one", () => {
    const tex = "\\tempo 120\n.\n3.6{pm}.8 5.6\n";
    const once = toggleTechnique(tex, at(0, 0), "hammer")!;
    expect(once.text).toBe("\\tempo 120\n.\n3.6{pm h}.8 5.6\n");
    const twice = toggleTechnique(once.text, at(0, 0), "hammer")!;
    expect(twice.text).toBe(tex);
  });
});
