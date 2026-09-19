/**
 * Deterministic pseudo-randomness seeded by the current date.
 *
 * Anything ordered or picked with this stays identical for the whole day and
 * reshuffles tomorrow, so a practice list can feel varied without moving around
 * under the user mid-session.
 */

/** Linear congruential generator seeded with today's date (YYYYMMDD). */
export function createDailyRandom(): () => number {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let seed = parseInt(today, 10);
  return () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };
}

/** Fisher-Yates shuffle in place using the supplied random source. */
export function shuffleInPlace<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
