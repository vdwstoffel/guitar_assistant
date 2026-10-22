/**
 * Playback scrolling for the score canvas, replacing alphaTab's built-in
 * scroll handlers during playback.
 *
 * The problem (Jasper, 2026-10-21): with ScrollMode.Smooth, alphaTab scrolls
 * each staff system from its top to its bottom over the system's full playing
 * duration, starting at the system's first beat. On slow music the active bar
 * drifts steadily upward while you play it — measured on a 60 BPM score (4 s
 * per bar, 2 bars per line) the playhead slid from Y=224 to Y=114, over half
 * the visible viewport, before the line was finished. The bar you are playing
 * scrolls out of picture.
 *
 * Jasper's fix — a scroll-blocking rule, with alphaTab's own scroll speed
 * unchanged: scrolling is allowed only to bring the NEXT line up to the top
 * of the viewport (one animated step per system change, at
 * `settings.player.scrollSpeed`). While a line plays, that line is already
 * the first line in view, so nothing else scrolls and the active bar stays
 * put. The clamp at scrollTop 0 is the safety against any overshoot: the
 * score's own first line never scrolls out from under the playhead.
 */

interface ScrollState {
  /** Score-space y of the staff system the last scroll targeted — alphaTab
   * keys its own scrolling on exactly this (a system change is when
   * `masterBarBounds.realBounds.y` changes), so it is the line identity. */
  systemKey: number;
}

/**
 * The scrollTop that pins `barBounds`' line at the viewport top, in the same
 * coordinate space alphaTab's own Continuous handler uses (container offset +
 * score y + scrollOffsetY), clamped at 0 — the first-line safety rule: a
 * line near the top of the score never gets scrolled out from under the
 * playhead.
 */
export function pinnedScrollTop(barBounds: any, scrollOffsetY: number, containerOffsetY: number): number {
  const y = barBounds?.masterBarBounds?.realBounds?.y;
  if (!Number.isFinite(y)) return 0;
  return Math.max(0, containerOffsetY + y + scrollOffsetY);
}

/**
 * Create the custom scroll handler for an api; attach with
 * `api.customScrollHandler = createPlaybackScrollHandler(api)`.
 * alphaTab calls it instead of its built-in handlers (for any scrollMode
 * other than Off).
 */
export function createPlaybackScrollHandler(api: any): {
  onBeatCursorUpdating(startBeat: any): void;
  forceScrollTo(currentBeatBounds: any): void;
  [Symbol.dispose](): void;
} {
  let state: ScrollState | null = null;

  const container = () => api.uiFacade?.getScrollContainer?.();
  const scrollTopOf = () => {
    const c = container();
    const el = c?.element ?? c;
    return typeof el?.scrollTop === "number" ? el.scrollTop : 0;
  };
  const viewHeight = () => {
    const c = container();
    const el = c?.element ?? c;
    const h = (typeof c?.height === "number" && c.height > 0 ? c.height : el?.clientHeight) || 300;
    return h;
  };

  const settings = () => api.settings?.player ?? {};

  const containerOffsetY = (c: any) => {
    try {
      return api.uiFacade?.getOffset?.(c, api.container)?.y ?? 0;
    } catch {
      return 0;
    }
  };

  const pin = (barBounds: any, speedMs: number) => {
    const c = container();
    if (!c) return;
    const target = pinnedScrollTop(barBounds, settings().scrollOffsetY ?? 0, containerOffsetY(c));
    // The blocking rule: the line already sits at its pinned position (it is
    // the first line in view), so there is nothing to scroll. A difference
    // under a couple of pixels is the same pin.
    if (Math.abs(scrollTopOf() - target) <= 2) return;
    api.uiFacade.scrollToY(c, target, speedMs);
  };

  return {
    // alphaTab's IScrollHandler declares [Symbol.dispose]; nothing to tear
    // down here (no resize listeners, no animation bookkeeping of our own).
    [Symbol.dispose]() {},

    onBeatCursorUpdating(currentBeatBounds: any) {
      // alphaTab hands over a BeatBoundings (not a beat): the line identity
      // is its masterBarBounds.realBounds.y, the same value its own
      // Continuous handler uses to detect system changes. (`barBounds.bar`
      // is NOT populated here — measured live 2026-10-21.)
      const barBounds = currentBeatBounds?.barBounds;
      const y = barBounds?.masterBarBounds?.realBounds?.y;
      if (!Number.isFinite(y)) return;
      const key = Math.round(y);
      if (!state || state.systemKey !== key) {
        // A new bar is being played. Bring its line up to the viewport top
        // at alphaTab's own scroll speed — one glide per line boundary (bars
        // on the same line pin to the same target, so they stay blocked).
        // A seek can also land here with the playhead far off-screen (a
        // click many lines down while stopped); then the glide would crawl
        // across the whole score, so that one step jumps instead.
        const c = container();
        const y = barBounds?.masterBarBounds?.realBounds?.y;
        const onScreenY = Number.isFinite(y)
          ? containerOffsetY(c) + y - scrollTopOf()
          : 0;
        const farOff = onScreenY < 0 || onScreenY > viewHeight();
        const speedMs = farOff ? 0 : settings().scrollSpeed ?? 300;
        pin(barBounds, speedMs);
        state = { systemKey: key };
        return;
      }
      // Same line as before: the blocking rule — while the played line is
      // the first line in view, no scrolling happens.
    },

    /** Seek / scrollToCursor: pin the clicked bar's line at once. */
    forceScrollTo(currentBeatBounds: any) {
      pin(currentBeatBounds?.barBounds, 0);
      const y = currentBeatBounds?.barBounds?.masterBarBounds?.realBounds?.y;
      // Re-arm: the next cursor update re-evaluates its own line boundary
      // even when it is this same line again.
      state = Number.isFinite(y) ? { systemKey: Math.round(y) - 1 } : null;
    },
  };
}
