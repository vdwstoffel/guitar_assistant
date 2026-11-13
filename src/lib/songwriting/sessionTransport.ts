/**
 * When a hidden score player should start, and when it should start again
 * after a reload.
 *
 * Every change to what a riff plays hands alphaTab a new score, and loading a
 * new score's midi stops the synth (a sound-bank swap pauses it). When it
 * was playing it should carry on with the new score, so the
 * reload arms a resume, and the resume fires once the new midi is in:
 *
 * - `reload(wasPlaying)` just before the new score (or bank) is handed over.
 *   It also carries over a resume that is still pending, so a second change
 *   that lands before the first has resumed keeps the intent — and replaces
 *   the first one's poll: there is only ever one pending resume.
 * - `kick()` once the player has the new content (alphaTab's `midiLoad`).
 *   That starts a poll of `isReady` every `pollMs`, up to `maxPolls` times.
 *   Never synchronously: alphaTab fires `midiLoad` *before* it posts the midi
 *   to its synth worker, so a play issued from inside the handler would reach
 *   the worker first and be stopped by the load right behind it.
 * - `confirmPlaying()` when the player reports it is playing. Until then the
 *   start still counts as pending, so the transport reads "playing" straight
 *   through a reload, and a change made in the moment between asking to play
 *   and the player saying so still resumes.
 *
 * Pure apart from the timer, so it can be tested without alphaTab. (Do not
 * resume off alphaTab's `midiLoaded`: subscribing to it recurses forever in
 * 1.8.1's worker player.)
 */

export interface SessionTransportDeps {
  /** Whether the player can play right now (alphaTab's `isReadyForPlayback`). */
  isReady(): boolean;
  /** Start playback (alphaTab's `play`). */
  play(): void;
  /** Called whenever `pending` flips. */
  onPendingChange?(pending: boolean): void;
  /** Milliseconds between readiness checks. Default 100. */
  pollMs?: number;
  /** How many checks before giving up (covers waiting for the play to be confirmed too). Default 50, i.e. 5 s. */
  maxPolls?: number;
}

export interface SessionTransport {
  /** A start or resume is underway: asked for, not yet confirmed by the player. */
  readonly pending: boolean;
  /** Play now, or as soon as the player is ready. Plays synchronously when it can, so a click's user gesture reaches the audio context. */
  start(): void;
  /** A new score or bank is about to be loaded; resume afterwards if it was playing or about to. */
  reload(wasPlaying: boolean): void;
  /** The reloaded content has been handed to the player; begin polling for the resume. */
  kick(): void;
  /** The player reports it is playing. */
  confirmPlaying(): void;
  /** Drop any pending start or resume. */
  cancel(): void;
  /** Cancel, and ignore every later call. */
  dispose(): void;
}

type Phase =
  /** Nothing pending. */
  | "idle"
  /** A resume is wanted; waiting for the reloaded content to reach the player. */
  | "armed"
  /** Checking readiness on a timer. */
  | "polling"
  /** play() issued; waiting for the player to confirm. */
  | "starting";

export function createSessionTransport(deps: SessionTransportDeps): SessionTransport {
  const pollMs = deps.pollMs ?? 100;
  const maxPolls = deps.maxPolls ?? 50;

  let phase: Phase = "idle";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let polls = 0;
  let disposed = false;

  // A function, so a check made after calling out (play() may confirm or
  // cancel synchronously) reads the phase afresh instead of a narrowed copy.
  const isPending = () => phase !== "idle";

  const setPhase = (next: Phase) => {
    const was = isPending();
    phase = next;
    const now = isPending();
    if (was !== now) deps.onPendingChange?.(now);
  };

  const stopTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    timer = setTimeout(tick, pollMs);
  };

  const issuePlay = () => {
    // The phase first: a player that confirms synchronously must find it.
    setPhase("starting");
    deps.play();
  };

  function tick() {
    timer = null;
    if (disposed || phase === "idle" || phase === "armed") return;
    polls += 1;
    if (phase === "polling" && deps.isReady()) issuePlay();
    // Confirmed or cancelled from inside play(), or restarted by it.
    if (!isPending() || timer !== null) return;
    if (polls >= maxPolls) {
      setPhase("idle");
      return;
    }
    schedule();
  }

  const beginPolling = () => {
    stopTimer();
    polls = 0;
    setPhase("polling");
    schedule();
  };

  return {
    get pending() {
      return isPending();
    },
    start() {
      if (disposed) return;
      stopTimer();
      polls = 0;
      if (deps.isReady()) {
        issuePlay();
        // The same budget for the confirmation as for a resume.
        if (isPending() && timer === null) schedule();
      } else {
        setPhase("polling");
        schedule();
      }
    },
    reload(wasPlaying: boolean) {
      if (disposed) return;
      const resume = wasPlaying || phase !== "idle";
      // Supersedes whatever an earlier reload was still waiting on.
      stopTimer();
      setPhase(resume ? "armed" : "idle");
    },
    kick() {
      if (disposed || phase !== "armed") return;
      beginPolling();
    },
    confirmPlaying() {
      // Only a play this transport issued counts: a "playing" from before the
      // latest reload is about to be stopped by it.
      if (disposed || phase !== "starting") return;
      stopTimer();
      setPhase("idle");
    },
    cancel() {
      if (disposed) return;
      stopTimer();
      setPhase("idle");
    },
    dispose() {
      stopTimer();
      phase = "idle";
      disposed = true;
    },
  };
}
