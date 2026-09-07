"use client";

import { useEffect, useState } from "react";

/** Matches Tailwind's `xl` breakpoint, where the two-pane layout appears. */
const XL_QUERY = "(min-width: 1280px)";

/**
 * Whether the viewport is wide enough for the side-by-side practice layout.
 *
 * Starts false so server and first client render agree; the effect corrects it
 * before paint.
 */
export function useIsWideViewport(): boolean {
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(XL_QUERY);
    const update = () => setIsWide(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isWide;
}
