import { describe, it, expect } from "vitest";
import {
  shouldCollapseOnPlay,
  resolveBarOpacity,
  usesFloatingLayout,
  BAR_IDLE_OPACITY,
  BAR_IDLE_DELAY_MS,
  markerShortcutIndex,
} from "./practiceLayout";

describe("shouldCollapseOnPlay", () => {
  it("collapses when playback starts", () => {
    expect(shouldCollapseOnPlay(false, true)).toBe(true);
  });

  it("stays collapsed when playback pauses", () => {
    // Pausing happens constantly mid-practice; re-expanding would make the
    // page jump under the user.
    expect(shouldCollapseOnPlay(true, false)).toBe(true);
  });

  it("leaves an expanded list alone while paused", () => {
    expect(shouldCollapseOnPlay(false, false)).toBe(false);
  });

  it("keeps a collapsed list collapsed while playing", () => {
    expect(shouldCollapseOnPlay(true, true)).toBe(true);
  });
});

describe("resolveBarOpacity", () => {
  const idle = {
    isPlaying: true,
    isHovered: false,
    msSinceMouseMove: BAR_IDLE_DELAY_MS + 1,
    isPopoverOpen: false,
    isWaveformExpanded: false,
  };

  it("fades only while playing and idle", () => {
    expect(resolveBarOpacity(idle)).toBe(BAR_IDLE_OPACITY);
  });

  it("stays solid while paused", () => {
    expect(resolveBarOpacity({ ...idle, isPlaying: false })).toBe(1);
  });

  it("stays solid while hovered", () => {
    expect(resolveBarOpacity({ ...idle, isHovered: true })).toBe(1);
  });

  it("stays solid just after the pointer moved", () => {
    expect(resolveBarOpacity({ ...idle, msSinceMouseMove: 0 })).toBe(1);
  });

  it("stays solid exactly at the idle threshold", () => {
    expect(
      resolveBarOpacity({ ...idle, msSinceMouseMove: BAR_IDLE_DELAY_MS })
    ).toBe(1);
  });

  it("stays solid while the settings popover is open", () => {
    expect(resolveBarOpacity({ ...idle, isPopoverOpen: true })).toBe(1);
  });

  it("stays solid while the waveform is expanded", () => {
    expect(resolveBarOpacity({ ...idle, isWaveformExpanded: true })).toBe(1);
  });
});

describe("usesFloatingLayout", () => {
  const floating = { isWideViewport: true, hasPdf: true, isShowingVideo: false };

  it("floats on a wide viewport showing a PDF", () => {
    expect(usesFloatingLayout(floating)).toBe(true);
  });

  it("docks below the xl breakpoint", () => {
    expect(usesFloatingLayout({ ...floating, isWideViewport: false })).toBe(false);
  });

  it("docks when the book has no PDF", () => {
    // Collapsing the list to a rail just to reveal an empty-state panel
    // would be absurd.
    expect(usesFloatingLayout({ ...floating, hasPdf: false })).toBe(false);
  });

  it("docks when a video is showing", () => {
    expect(usesFloatingLayout({ ...floating, isShowingVideo: true })).toBe(false);
  });
});

describe("markerShortcutIndex", () => {
  it("maps 1-9 to the first nine markers", () => {
    expect(markerShortcutIndex("1")).toBe(0);
    expect(markerShortcutIndex("5")).toBe(4);
    expect(markerShortcutIndex("9")).toBe(8);
  });

  it("maps 0 to the tenth marker, not the first", () => {
    expect(markerShortcutIndex("0")).toBe(9);
  });

  it("ignores non-digits", () => {
    for (const key of ["a", "-", "?", "Enter", "", "10"]) {
      expect(markerShortcutIndex(key)).toBeNull();
    }
  });
});
