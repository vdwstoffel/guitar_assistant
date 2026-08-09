export interface PageFlip {
  timestamp: number;
  pdfPage: number;
}

// Resolve which PDF page should be showing at `currentTime`.
// Returns the page of the latest flip whose (timestamp - anticipation) has
// been passed; before any flip, returns `fallbackPage`.
export function resolvePageFlip(
  flips: PageFlip[],
  currentTime: number,
  anticipationSeconds: number,
  fallbackPage: number | null
): number | null {
  let best: PageFlip | null = null;
  for (const f of flips) {
    if (currentTime >= f.timestamp - anticipationSeconds) {
      if (best === null || f.timestamp > best.timestamp) best = f;
    }
  }
  return best ? best.pdfPage : fallbackPage;
}

// Validate a raw page-flip payload from a request body.
export function validatePageFlipInput(
  raw: unknown
): { ok: true; value: { timestamp: number; pdfPage: number } } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid page-flip payload" };
  }
  const { timestamp, pdfPage } = raw as Record<string, unknown>;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp < 0) {
    return { ok: false, error: "Invalid timestamp" };
  }
  if (typeof pdfPage !== "number" || !Number.isInteger(pdfPage) || pdfPage < 1) {
    return { ok: false, error: "Invalid pdfPage" };
  }
  return { ok: true, value: { timestamp, pdfPage } };
}
