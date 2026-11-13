/**
 * Latest-wins batching for score changes made while a riff plays.
 *
 * Each reload restarts the loop from bar 1, so five quick tempo changes
 * would be five restarts in half a second. While playing, a change is held
 * for `delayMs` after the last one and only the newest is applied; the old
 * score keeps sounding meanwhile. (While stopped the caller loads at once.)
 */

export interface Coalescer<T> {
  /** A value is waiting to be applied. */
  readonly pending: boolean;
  /** Hold `value`, replacing any held one, and restart the wait. */
  push(value: T): void;
  /** Apply the held value now, if there is one. */
  flush(): void;
  /** Drop the held value. */
  cancel(): void;
}

export function createCoalescer<T>(delayMs: number, apply: (value: T) => void): Coalescer<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let held: { value: T } | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = () => {
    clear();
    const next = held;
    held = null;
    if (next) apply(next.value);
  };

  return {
    get pending() {
      return held !== null;
    },
    push(value: T) {
      held = { value };
      clear();
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      clear();
      held = null;
    },
  };
}
