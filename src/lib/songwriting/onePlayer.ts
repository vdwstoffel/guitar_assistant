/**
 * One player at a time while tabbing a riff.
 *
 * Tab it out puts two players on screen: the riff's take, looping, and the
 * tab's own playback. Heard together they are a mess, so they form a group
 * in which starting one pauses the others. Unlike `@/lib/playerFocus` (which
 * of two players the keyboard belongs to, page-wide, for BottomPlayer and
 * the Guitar Pro score), a group is local to the screen that made it.
 */
export interface OnePlayerGroup {
  /** Join with the way to pause this member. */
  join(pause: () => void): OnePlayerMember;
}

export interface OnePlayerMember {
  /** This member started playing: pause every other one. */
  started(): void;
  leave(): void;
}

export function createOnePlayerGroup(): OnePlayerGroup {
  const members = new Set<{ pause: () => void }>();
  return {
    join(pause) {
      const me = { pause };
      members.add(me);
      return {
        started() {
          for (const other of [...members]) if (other !== me) other.pause();
        },
        leave() {
          members.delete(me);
        },
      };
    },
  };
}

export interface KeyLike {
  key: string;
  repeat?: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * What a key press inside the take player's controls does: plain Space
 * toggles the take (held down, only the first press counts, the repeats are
 * swallowed so they press nothing else); any other key is left alone.
 */
export function takeKeyAction(e: KeyLike): "toggle" | "swallow" | null {
  if (e.key !== " " || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return null;
  return e.repeat ? "swallow" : "toggle";
}
