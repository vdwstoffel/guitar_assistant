import { describe, it, expect } from "vitest";
import { anchorInView, MENU_GAP, placeMenu, type Rect } from "./placeMenu";

// A score panel 600 px wide and 400 px tall, at (100, 100).
const PANEL: Rect = { left: 100, top: 100, width: 600, height: 400 };
const MENU = { width: 320, height: 150 };
const bar = (left: number, top: number, height = 80, width = 200): Rect => ({ left, top, width, height });

describe("placeMenu", () => {
  it("goes below the bar, its left edge at the anchor beat", () => {
    expect(placeMenu({ anchor: bar(150, 120), menu: MENU, bounds: PANEL })).toEqual({
      left: 150,
      top: 120 + 80 + MENU_GAP,
      maxHeight: 500 - (200 + MENU_GAP),
      side: "below",
    });
  });

  it("leaves 4 px between the bar and the menu", () => {
    // The bar ends at 120 + 80 = 200. The gap is written out here, not as MENU_GAP, so changing it fails a test.
    expect(placeMenu({ anchor: bar(150, 120), menu: MENU, bounds: PANEL }).top).toBe(200 + 4);
    expect(MENU_GAP).toBe(4);
  });

  it("goes below, not above, when the menu fits on both sides", () => {
    // A bar in the middle of the panel, ending at 340: 156 px of room below it, 196 px above it, a 150 px menu.
    // Above has more room, so a menu that went to the roomier side would be on the wrong side.
    expect(placeMenu({ anchor: bar(150, 300, 40), menu: MENU, bounds: PANEL })).toEqual({
      left: 150,
      top: 340 + MENU_GAP,
      maxHeight: 500 - (340 + MENU_GAP),
      side: "below",
    });
  });

  it("goes below when the menu exactly fills the room there", () => {
    // The bar ends at 346, so with the 4 px gap there are exactly 150 px below it (to 500), and 202 px above it.
    expect(placeMenu({ anchor: bar(150, 306, 40), menu: MENU, bounds: PANEL })).toEqual({
      left: 150,
      top: 350,
      maxHeight: 150,
      side: "below",
    });
  });

  it("flips above when there is no room below", () => {
    expect(placeMenu({ anchor: bar(150, 380), menu: MENU, bounds: PANEL })).toEqual({
      left: 150,
      top: 380 - MENU_GAP - 150,
      maxHeight: 380 - MENU_GAP - 100,
      side: "above",
    });
  });

  it("is moved left to end inside the panel, and never starts left of it", () => {
    expect(placeMenu({ anchor: bar(600, 120), menu: MENU, bounds: PANEL }).left).toBe(700 - 320);
    expect(placeMenu({ anchor: bar(40, 120), menu: MENU, bounds: PANEL }).left).toBe(100);
    // Wider than the panel: its left edge stays on the panel's.
    expect(placeMenu({ anchor: bar(300, 120), menu: { width: 900, height: 150 }, bounds: PANEL }).left).toBe(100);
  });

  it("takes the larger side when neither fits, and scrolls inside it", () => {
    const tall = { width: 320, height: 380 };
    // 196 px below a bar ending at 300, 146 px above it: below wins.
    expect(placeMenu({ anchor: bar(150, 250, 50), menu: tall, bounds: PANEL })).toEqual({
      left: 150,
      top: 300 + MENU_GAP,
      maxHeight: 500 - 300 - MENU_GAP,
      side: "below",
    });
    // 46 px below a bar ending at 450, 296 px above it: above wins, and starts at the panel's top.
    expect(placeMenu({ anchor: bar(150, 400, 50), menu: tall, bounds: PANEL })).toEqual({
      left: 150,
      top: 100,
      maxHeight: 400 - MENU_GAP - 100,
      side: "above",
    });
  });

  it("counts only the room inside the panel when the bar is partly out of it", () => {
    // The bar's top is scrolled out above the panel; below it there is room.
    expect(placeMenu({ anchor: bar(150, 60, 80), menu: MENU, bounds: PANEL })).toMatchObject({ top: 140 + MENU_GAP, side: "below" });
    // The bar runs out of the bottom of the panel: nothing below, so above.
    const out = placeMenu({ anchor: bar(150, 450, 100), menu: MENU, bounds: PANEL });
    expect(out).toEqual({ left: 150, top: 450 - MENU_GAP - 150, maxHeight: 450 - MENU_GAP - 100, side: "above" });
  });

  it("keeps the menu inside the panel when the bar is wholly above or below it", () => {
    // Wholly above (it ends at 60): all 400 px of the panel are room below, and the menu starts at the panel's top.
    expect(placeMenu({ anchor: bar(150, 20, 40), menu: MENU, bounds: PANEL })).toEqual({
      left: 150,
      top: 100,
      maxHeight: 400,
      side: "below",
    });
    // Wholly below (it starts at 600): all 400 px are room above, and the menu ends at the panel's bottom.
    expect(placeMenu({ anchor: bar(150, 600, 80), menu: MENU, bounds: PANEL })).toEqual({
      left: 150,
      top: 350,
      maxHeight: 400,
      side: "above",
    });
  });

  it("has no height to give when the bar is taller than the panel", () => {
    // The bar runs from 90 to 540 across the panel's 100 to 500: no room above it or below it, so the menu
    // sits on the panel's bottom edge with a maxHeight of 0.
    expect(placeMenu({ anchor: bar(150, 90, 450), menu: MENU, bounds: PANEL })).toEqual({
      left: 150,
      top: 500,
      maxHeight: 0,
      side: "below",
    });
  });

  it("gives zero room, inside them, for zero-size bounds", () => {
    const none: Rect = { left: 100, top: 50, width: 0, height: 0 };
    expect(placeMenu({ anchor: bar(150, 200), menu: MENU, bounds: none })).toEqual({ left: 100, top: 50, maxHeight: 0, side: "below" });
  });
});

describe("anchorInView", () => {
  it("holds while any of the bar is inside the panel", () => {
    expect(anchorInView(bar(150, 120), PANEL)).toBe(true);
    expect(anchorInView(bar(150, 60, 80), PANEL)).toBe(true);
    expect(anchorInView(bar(150, 450, 100), PANEL)).toBe(true);
  });

  it("fails once the bar has scrolled out, above or below, or for empty bounds", () => {
    expect(anchorInView(bar(150, 10, 90), PANEL)).toBe(false);
    expect(anchorInView(bar(150, 500), PANEL)).toBe(false);
    expect(anchorInView(bar(150, 120), { left: 100, top: 100, width: 0, height: 0 })).toBe(false);
  });

  it("holds while any of the bar is inside the panel sideways, and for a bar of no width", () => {
    expect(anchorInView(bar(0, 120, 80, 300), PANEL)).toBe(true); // runs in over the panel's left edge
    expect(anchorInView(bar(650, 120), PANEL)).toBe(true); // runs out over its right edge
    // `barClientRect` floors a bar's width at 0; one inside the panel is still in view, even on its left edge.
    expect(anchorInView(bar(150, 120, 80, 0), PANEL)).toBe(true);
    expect(anchorInView(bar(100, 120, 80, 0), PANEL)).toBe(true);
  });

  it("fails once the bar has scrolled out sideways, to the left or to the right", () => {
    expect(anchorInView(bar(-400, 120, 80, 300), PANEL)).toBe(false); // wholly left of the panel
    expect(anchorInView(bar(-200, 120, 80, 300), PANEL)).toBe(false); // ends exactly on its left edge
    expect(anchorInView(bar(800, 120), PANEL)).toBe(false); // wholly right of it
    expect(anchorInView(bar(700, 120), PANEL)).toBe(false); // starts exactly on its right edge
  });

  it("fails for bounds with no area, even when the bar straddles them", () => {
    // A score panel scrolled off the window is measured as a box with no height (or width), edge-on to the bar.
    expect(anchorInView({ left: 160, top: 850, width: 300, height: 150 }, { left: 100, top: 900, width: 700, height: 0 })).toBe(false);
    expect(anchorInView(bar(80, 10, 200, 300), { left: 100, top: 100, width: 0, height: 0 })).toBe(false);
    expect(anchorInView(bar(80, 120, 80, 300), { left: 100, top: 100, width: 0, height: 400 })).toBe(false);
  });
});
