/**
 * Lyrics not yet confirmed saved when their pad went away (the song closed,
 * or another one opened), by song id. While any are held the page asks before
 * it closes; the next pad opened for that song restores the text and saves it
 * again.
 */
export interface LyricsHolder {
  /** Keep this text for the song (replacing what was held for it). */
  hold(songId: string, text: string): void;
  /** A save of `text` landed (or the song is gone): let it go, unless other text is held for the song. */
  release(songId: string, text: string): void;
  /** What is held for the song, left in place. */
  peek(songId: string): string | null;
  /** What is held for the song, taken out: the pad opening it now owns it. */
  take(songId: string): string | null;
}

/** `onHolding` hears when the holder goes from empty to holding something, and back. */
export function createLyricsHolder(onHolding?: (holding: boolean) => void): LyricsHolder {
  const held = new Map<string, string>();
  const changed = (wasHolding: boolean) => {
    const holding = held.size > 0;
    if (holding !== wasHolding) onHolding?.(holding);
  };
  return {
    hold(songId, text) {
      const was = held.size > 0;
      held.set(songId, text);
      changed(was);
    },
    release(songId, text) {
      if (held.get(songId) !== text) return;
      held.delete(songId);
      changed(true);
    },
    peek: (songId) => held.get(songId) ?? null,
    take(songId) {
      const text = held.get(songId);
      if (text === undefined) return null;
      held.delete(songId);
      changed(true);
      return text;
    },
  };
}
