import { describe, it, expect } from "vitest";
import {
  NO_NOTE_REASON, NOTHING_TO_PASTE, NOTHING_TO_TIE_NOTICE, PARSE_ERROR_NOTICE, PARSE_REASON, pastedFromEditorNotice,
} from "./menuMessages";

describe("menuMessages", () => {
  it("says why an item is disabled in the spec's words", () => {
    expect(PARSE_REASON).toBe("The tab doesn't parse");
    expect(NO_NOTE_REASON).toBe("No note on this string");
    expect(NOTHING_TO_PASTE).toBe("Nothing to paste");
  });

  it("keeps the editor's notices word for word", () => {
    expect(PARSE_ERROR_NOTICE).toBe("Fix the source errors to edit on the canvas");
    expect(NOTHING_TO_TIE_NOTICE).toBe("Nothing earlier on this string to tie to");
  });

  it("says when a menu Paste fell back on the editor's own copy, sized like a paste", () => {
    expect(pastedFromEditorNotice({ wholeBars: false, bars: 1, beats: 3 })).toBe(
      "Pasted 3 beats copied in the editor — the browser didn't share its clipboard",
    );
    expect(pastedFromEditorNotice({ wholeBars: true, bars: 1, beats: 8 })).toBe(
      "Pasted 1 bar copied in the editor — the browser didn't share its clipboard",
    );
  });
});
