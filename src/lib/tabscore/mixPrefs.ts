/**
 * The tab editor's listening preferences: how loud the score plays and
 * whether the metronome clicks.
 *
 * Kept in localStorage rather than on the tab in the database, unlike the
 * practice speed beside them. Speed is a property of how you are working
 * THIS exercise; these are a property of how you like to listen, and wanting
 * the click on does not change from one tab to the next. It also keeps a
 * migration off a database whose contents are hand-made and valuable.
 *
 * Every accessor is wrapped: localStorage throws in a private window and
 * with site data blocked, and returns nothing at all in a fresh profile. The
 * defaults are perfectly usable, so a failure here is not worth reporting.
 */
export interface MixPrefs {
  /** Score playback volume, 0-1, in alphaTab's own unit. */
  volume: number;
  /** Metronome click volume when it is on, 0-1. Never zero — see `on`. */
  metronome: number;
  /** alphaTab has no enable flag; off is written as a volume of zero. */
  metronomeOn: boolean;
  /**
   * Tick out a bar before playback starts. Independent of the metronome —
   * counting yourself in and then playing to silence is a normal way to
   * practise — but it borrows the same level, since both are the same click.
   */
  countIn: boolean;
}

const KEY = "tabEditorMix";

export const DEFAULT_MIX: MixPrefs = {
  volume: 1,
  metronome: 0.7,
  metronomeOn: false,
  countIn: true,
};

function clamp01(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function loadMix(): MixPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_MIX;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_MIX;
    const p = parsed as Partial<Record<keyof MixPrefs, unknown>>;
    return {
      volume: clamp01(p.volume, DEFAULT_MIX.volume),
      // A stored zero would make the slider useless the moment the click is
      // switched back on, so the audible level never goes below a whisper.
      metronome: Math.max(0.05, clamp01(p.metronome, DEFAULT_MIX.metronome)),
      metronomeOn: p.metronomeOn === true,
      // `!== false`, not `=== true`: prefs written before the count-in
      // existed have no flag at all, and those should get the default rather
      // than the opposite of it.
      countIn: p.countIn !== false,
    };
  } catch {
    return DEFAULT_MIX;
  }
}

function saveMix(mix: MixPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(mix));
  } catch {
    /* the choice just will not survive a reload */
  }
}

/*
 * Exposed as a `useSyncExternalStore` source rather than component state
 * seeded from an effect. localStorage cannot be read while rendering on the
 * server, and seeding it afterwards means rendering once with the defaults
 * and again with the stored values — the cascading render React warns about.
 * A store gives `getServerSnapshot` for the first pass and a stable cached
 * object for the rest, so the values are right from the client's first
 * render. The snapshot must stay referentially stable between writes or
 * React re-renders without end, which is what `cached` is for.
 */
let cached: MixPrefs | null = null;
const listeners = new Set<() => void>();

export function subscribeMix(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMix(): MixPrefs {
  if (cached === null) cached = loadMix();
  return cached;
}

/** The first render happens on the server, where nothing is stored yet. */
export function getServerMix(): MixPrefs {
  return DEFAULT_MIX;
}

export function setMix(next: MixPrefs): void {
  cached = next;
  saveMix(next);
  for (const listener of listeners) listener();
}

/** What alphaTab's `metronomeVolume` should be, given the toggle. */
export function metronomeVolumeOf(mix: MixPrefs): number {
  return mix.metronomeOn ? mix.metronome : 0;
}

/**
 * What alphaTab's `countInVolume` should be.
 *
 * Reads the level directly rather than going through `metronomeVolumeOf`:
 * a count-in with the metronome switched off still has to be audible, which
 * is the whole point of counting yourself in and then playing to silence.
 */
export function countInVolumeOf(mix: MixPrefs): number {
  return mix.countIn ? mix.metronome : 0;
}
