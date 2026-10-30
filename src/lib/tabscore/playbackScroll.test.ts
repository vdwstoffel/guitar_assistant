import { describe, expect, it } from "vitest";

import { createPlaybackScrollHandler, pinnedScrollTop } from "./playbackScroll";

/**
 * Stand-ins for what alphaTab actually hands the handler: a BeatBoundings
 * object ({barBounds: {masterBarBounds: {realBounds}}, …}) — `barBounds.bar`
 * is NOT populated by alphaTab (measured live 2026-10-21), the line identity
 * is masterBarBounds.realBounds.y.
 */
function fakeApi(opts: { scrollTop?: number; scrollOffsetY?: number; offset?: number }) {
  const scrolls: { target: number; speed: number }[] = [];
  const el = { scrollTop: opts.scrollTop ?? 0, clientHeight: 370 };
  const container = { element: el, height: 370 };
  const api: any = {
    container: {},
    settings: { player: { scrollOffsetY: opts.scrollOffsetY ?? -40, scrollSpeed: 300 } },
    uiFacade: {
      getScrollContainer: () => container,
      getOffset: (_scroll: any, _c: any) => ({ y: opts.offset ?? 100 }),
      scrollToY: (_el: any, target: number, speed: number) => scrolls.push({ target, speed }),
    },
  };
  return { api, scrolls, el };
}

/** BeatBoundings stand-in for a beat on the line whose system top is `y`. */
const beatBounds = (y: number) => ({
  barBounds: { masterBarBounds: { realBounds: { y, h: 125 } } },
});

describe("pinnedScrollTop", () => {
  it("pins the line's own y at the viewport top, alphaTab's coordinate space", () => {
    // Same math as VerticalContinuousScrollHandler: offset + y + scrollOffsetY.
    expect(pinnedScrollTop(beatBounds(344).barBounds, -40, 100)).toBe(404);
  });

  it("clamps at 0 so a line near the score top never scrolls out (first-line rule)", () => {
    expect(pinnedScrollTop(beatBounds(20).barBounds, -40, 0)).toBe(0);
    expect(pinnedScrollTop({ masterBarBounds: { realBounds: { y: NaN } } }, -40, 0)).toBe(0);
  });
});

describe("createPlaybackScrollHandler", () => {
  it("glides once at a new line boundary, at alphaTab's own scrollSpeed", () => {
    const { api, scrolls, el } = fakeApi({ scrollTop: 100, offset: 100 });
    const handler = createPlaybackScrollHandler(api);
    handler.onBeatCursorUpdating(beatBounds(344)); // playhead enters a new line
    expect(scrolls).toEqual([{ target: 404, speed: 300 }]);

    // Further bars on the same line (same system y): already pinned → blocked.
    el.scrollTop = 404;
    handler.onBeatCursorUpdating(beatBounds(344));
    handler.onBeatCursorUpdating(beatBounds(344));
    expect(scrolls.length).toBe(1);
  });

  it("blocks scrolling while the played line is the first line in view", () => {
    const { api, scrolls, el } = fakeApi({ scrollTop: 404, offset: 100 });
    const handler = createPlaybackScrollHandler(api);
    // Every new bar of the line re-checks the pin and finds nothing to do.
    for (let i = 0; i < 8; i++) handler.onBeatCursorUpdating(beatBounds(344));
    expect(scrolls).toEqual([]);
    expect(el.scrollTop).toBe(404);
  });

  it("never scrolls the score's own first line out of view (clamp at 0)", () => {
    const { api, scrolls } = fakeApi({ scrollTop: 0, offset: 0 });
    const handler = createPlaybackScrollHandler(api);
    // First line: its pin would be 20 - 40 < 0; clamped to 0, where the view
    // already is — so nothing scrolls at all.
    handler.onBeatCursorUpdating(beatBounds(20));
    expect(scrolls).toEqual([]);
    handler.onBeatCursorUpdating(beatBounds(20));
    expect(scrolls).toEqual([]);
  });

  it("jumps (speed 0) when a seek landed far off-screen instead of gliding across the score", () => {
    const { api, scrolls } = fakeApi({ scrollTop: 100, offset: 100 });
    const handler = createPlaybackScrollHandler(api);
    // A bar thousands of px below the viewport — a seek many lines down.
    handler.onBeatCursorUpdating(beatBounds(3400));
    expect(scrolls).toEqual([{ target: 3460, speed: 0 }]);
  });

  it("forceScrollTo pins the clicked line instantly and re-arms the next boundary", () => {
    const { api, scrolls, el } = fakeApi({ scrollTop: 100, offset: 100 });
    const handler = createPlaybackScrollHandler(api);
    handler.forceScrollTo(beatBounds(344));
    expect(scrolls).toEqual([{ target: 404, speed: 0 }]);
    // Playing that same line afterwards re-evaluates its boundary.
    el.scrollTop = 404;
    handler.onBeatCursorUpdating(beatBounds(344));
    expect(scrolls.length).toBe(1);
  });
});
