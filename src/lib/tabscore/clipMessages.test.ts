import { describe, it, expect } from "vitest";
import {
  clipOutcomeNotice, copiedNotice, cutNotice, duplicatedNotice, NOT_A_PASSAGE_NOTICE, pastedNotice, SELECTION_CLEARED,
  selectionAnnouncement,
} from "./clipMessages";
import { refuse as refused } from "./apply";

const RESULT = { text: "", caret: { barIndex: 0, beatIndex: 0, string: 6 } };

describe("what was copied, cut, pasted or duplicated", () => {
  it("counts beats, or bars when they were whole bars", () => {
    expect(copiedNotice({ wholeBars: false, bars: 1, beats: 3 })).toBe("Copied 3 beats");
    expect(copiedNotice({ wholeBars: true, bars: 2, beats: 8 })).toBe("Copied 2 bars");
    expect(copiedNotice({ wholeBars: false, bars: 1, beats: 1 })).toBe("Copied 1 beat");
    expect(cutNotice({ wholeBars: false, bars: 2, beats: 5 })).toBe("Cut 5 beats");
    expect(pastedNotice({ wholeBars: true, bars: 1, beats: 4 })).toBe("Pasted 1 bar");
  });

  it("names the bar a single-bar duplicate copied", () => {
    expect(duplicatedNotice({ wholeBars: true, bars: 1, beats: 4 }, 4)).toBe("Duplicated bar 5");
    expect(duplicatedNotice({ wholeBars: true, bars: 2, beats: 8 }, 4)).toBe("Duplicated 2 bars");
    expect(duplicatedNotice({ wholeBars: false, bars: 1, beats: 3 }, 4)).toBe("Duplicated 3 beats");
  });
});

describe("clipOutcomeNotice", () => {
  it("says nothing when the command acted, or found nothing to do", () => {
    expect(clipOutcomeNotice("paste", { kind: "ok", result: RESULT })).toBeNull();
    expect(clipOutcomeNotice("clear", { kind: "noop", reason: "alreadyRest" })).toBeNull();
  });

  it("names a bar the commands cannot read with each command's own verb", () => {
    expect(clipOutcomeNotice("copy", refused(4))).toBe("Can't copy bar 5 automatically — copy it from the source");
    expect(clipOutcomeNotice("cut", refused(4))).toBe("Can't cut bar 5 automatically — edit it in the source");
    expect(clipOutcomeNotice("paste", refused(4))).toBe("Can't paste into bar 5 automatically — edit it in the source");
    expect(clipOutcomeNotice("duplicate", refused(4))).toBe("Can't duplicate bar 5 automatically — edit it in the source");
    expect(clipOutcomeNotice("remove", refused(4))).toBe("Can't remove beats from bar 5 automatically — edit it in the source");
    expect(clipOutcomeNotice("clear", refused(4))).toBe("Can't clear bar 5 automatically — edit it in the source");
  });

  it("explains each refusal of a paste", () => {
    expect(clipOutcomeNotice("paste", refused(4, "doesNotFit"))).toBe(
      "That doesn't fit in the rest of bar 5 — Ctrl+Shift+V inserts it instead",
    );
    expect(clipOutcomeNotice("paste", refused(4, "crossesBarLine"))).toBe(
      "These beats cross a bar line — put the caret on a bar's first beat and press Ctrl+Shift+V",
    );
    expect(clipOutcomeNotice("paste", refused(4, "needsBarStart"))).toBe("Put the caret on a bar's first beat to paste bars");
    expect(clipOutcomeNotice("paste", refused(4, "remainderInexpressible"))).toBe(
      "Can't split the beat at bar 5 — paste at another beat",
    );
    expect(clipOutcomeNotice("paste", refused(4, "notAPassage"))).toBe(NOT_A_PASSAGE_NOTICE);
    expect(NOT_A_PASSAGE_NOTICE).toBe("That isn't a passage of tab — copy beats from the editor or the Source pane");
  });

  it("explains duplicate's own refusal", () => {
    expect(clipOutcomeNotice("duplicate", refused(4, "crossesBarLine"))).toBe(
      "Select whole bars, or beats inside one bar, to duplicate",
    );
  });

  it("explains each refusal of a removal", () => {
    expect(clipOutcomeNotice("remove", refused(4, "wouldEmptyBar"))).toBe("Can't remove every beat of bar 5 — select whole bars");
    expect(clipOutcomeNotice("remove", refused(0, "wouldRemoveAll"))).toBe("A tab needs at least one bar");
    expect(clipOutcomeNotice("remove", refused(4, "barsCarrySigns"))).toBe(
      "Bar 5 carries a sign (repeat, tempo, time signature or section) — remove it in the Source pane first",
    );
  });

  it("says bars, not beats, when whole bars cannot go because the tab has several tracks, staves or voices", () => {
    expect(clipOutcomeNotice("remove", refused(4, "severalTracks"))).toBe(
      "Can't remove bars from a tab with more than one track, staff or voice — edit it in the source",
    );
  });

  it("says the same of bars pasted or duplicated there, with their own verbs", () => {
    expect(clipOutcomeNotice("paste", refused(1, "severalTracks"))).toBe(
      "Can't paste bars into a tab with more than one track, staff or voice — edit it in the source",
    );
    expect(clipOutcomeNotice("duplicate", refused(0, "severalTracks"))).toBe(
      "Can't duplicate bars in a tab with more than one track, staff or voice — edit it in the source",
    );
  });

  // Shift+Delete over whole bars: what it could not remove was bars, never beats.
  it("names the bar, not its beats, when whole bars cannot be removed", () => {
    expect(clipOutcomeNotice("removeBars", refused(4))).toBe("Can't remove bar 5 automatically — edit it in the source");
    expect(clipOutcomeNotice("removeBars", refused(0, "wouldRemoveAll"))).toBe("A tab needs at least one bar");
    expect(clipOutcomeNotice("removeBars", refused(4, "barsCarrySigns"))).toBe(
      "Bar 5 carries a sign (repeat, tempo, time signature or section) — remove it in the Source pane first",
    );
    expect(clipOutcomeNotice("removeBars", refused(4, "severalTracks"))).toBe(
      "Can't remove bars from a tab with more than one track, staff or voice — edit it in the source",
    );
  });
});

describe("selectionAnnouncement: what a screen reader hears when the selection settles", () => {
  it("counts beats", () => {
    expect(selectionAnnouncement({ wholeBars: false, bars: 1, beats: 3 }, 0)).toBe("3 beats selected");
    expect(selectionAnnouncement({ wholeBars: false, bars: 2, beats: 5 }, 3)).toBe("5 beats selected");
    expect(selectionAnnouncement({ wholeBars: false, bars: 1, beats: 1 }, 7)).toBe("1 beat selected");
  });

  it("names whole bars, numbered from 1", () => {
    expect(selectionAnnouncement({ wholeBars: true, bars: 1, beats: 8 }, 1)).toBe("Bar 2 selected");
    expect(selectionAnnouncement({ wholeBars: true, bars: 3, beats: 12 }, 1)).toBe("Bars 2–4 selected");
  });

  it("says a cleared selection is cleared", () => {
    expect(SELECTION_CLEARED).toBe("Selection cleared");
  });
});
