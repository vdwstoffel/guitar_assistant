/**
 * Layout decisions for the practice view (Lessons and Jam Tracks).
 *
 * Kept free of React and the DOM so the behaviour can be tested directly.
 */

/** Opacity the floating bar drops to while playing and idle. */
export const BAR_IDLE_OPACITY = 0.35;

/** How long the pointer must sit still before the bar fades. */
export const BAR_IDLE_DELAY_MS = 3000;

/**
 * Whether the track list should be collapsed.
 *
 * Playback collapses it. Pausing deliberately does NOT expand it again —
 * pausing happens constantly mid-practice, and re-expanding would make the
 * page jump under the user. Only an explicit click on the rail expands.
 */
export function shouldCollapseOnPlay(
  isCollapsed: boolean,
  isPlaying: boolean
): boolean {
  return isCollapsed || isPlaying;
}

export interface BarOpacityInput {
  isPlaying: boolean;
  isHovered: boolean;
  msSinceMouseMove: number;
  isPopoverOpen: boolean;
  isWaveformExpanded: boolean;
}

/**
 * Opacity of the floating practice bar. It only fades while playback is
 * running and nothing is asking for the user's attention.
 */
export function resolveBarOpacity({
  isPlaying,
  isHovered,
  msSinceMouseMove,
  isPopoverOpen,
  isWaveformExpanded,
}: BarOpacityInput): number {
  if (!isPlaying) return 1;
  if (isHovered) return 1;
  if (isPopoverOpen) return 1;
  if (isWaveformExpanded) return 1;
  if (msSinceMouseMove <= BAR_IDLE_DELAY_MS) return 1;
  return BAR_IDLE_OPACITY;
}

export interface FloatingLayoutInput {
  isWideViewport: boolean;
  hasPdf: boolean;
  isShowingVideo: boolean;
}

/**
 * Whether the player should float over the PDF rather than dock below it.
 *
 * Floating only earns its keep when there is a PDF filling the panel. With no
 * PDF there is nothing to float over, and floating over a video player would
 * cover its own controls.
 */
export function usesFloatingLayout({
  isWideViewport,
  hasPdf,
  isShowingVideo,
}: FloatingLayoutInput): boolean {
  return isWideViewport && hasPdf && !isShowingVideo;
}

/**
 * Marker index for a digit shortcut: '1'-'9' map to markers 1-9, '0' to the
 * tenth. Returns null for anything that is not a digit.
 */
export function markerShortcutIndex(key: string): number | null {
  if (key.length !== 1 || key < "0" || key > "9") return null;
  return key === "0" ? 9 : Number(key) - 1;
}
