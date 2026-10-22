import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPreviewSynth } from "./previewSynth";

class Emitter<T extends unknown[] = []> {
  private handlers: Array<(...args: T) => void> = [];
  on(handler: (...args: T) => void) {
    this.handlers.push(handler);
  }
  fire(...args: T) {
    for (const handler of this.handlers) handler(...args);
  }
}

class FakeContext {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  audioWorklet = { addModule: vi.fn(async (_url: string) => {}) };
  setSinkId = vi.fn((id: string) => this.switchSink(id));
  destination = {};
  constructor(private readonly switchSink: (id: string) => Promise<void> = async () => {}) {}
}

/** A stand-in for the slice of alphaTab the preview synth touches. */
function fakeAlphaTab() {
  const log: string[] = [];
  const outputs: Array<WorkletOutput | ScriptOutput> = [];
  const synths: FakeSynth[] = [];
  const generated: unknown[][] = [];
  let generationFails = false;
  let constructionFails = false;
  let subscriptionFails = false;
  let switchSink: (id: string) => Promise<void> = async () => {};

  class WorkletOutput {
    context = new FakeContext((id) => switchSink(id));
    destroy = vi.fn();
    constructor(readonly settings: unknown) {
      outputs.push(this);
    }
  }
  class ScriptOutput {
    context = new FakeContext((id) => switchSink(id));
    destroy = vi.fn();
    constructor() {
      outputs.push(this);
    }
  }
  class FakeSynth {
    masterVolume = 1;
    playbackSpeed = 0.5;
    metronomeVolume = 1;
    countInVolume = 1;
    isLooping = true;
    soundFontLoaded = new Emitter();
    soundFontLoadFailed = new Emitter<[unknown]>();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    loadSoundFont = vi.fn((_data: Uint8Array, _append: boolean) => {
      log.push("loadSoundFont");
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    loadMidiFile = vi.fn((_midi: unknown) => {
      log.push(`loadMidiFile@${this.masterVolume}`);
    });
    play = vi.fn(() => {
      log.push("play");
      return true;
    });
    stop = vi.fn(() => {
      log.push("stop");
    });
    destroy = vi.fn(() => {
      log.push("destroy");
    });
    constructor(
      readonly output: WorkletOutput | ScriptOutput,
      readonly settings: unknown,
    ) {
      // alphaTab's constructor opens the output's AudioContext, then throws
      // when its worker cannot start (core.mjs:55571-55578).
      if (constructionFails) throw new TypeError("Cannot read properties of undefined (reading 'addEventListener')");
      synths.push(this);
      // A member a future alphaTab renamed.
      if (subscriptionFails) {
        this.soundFontLoaded.on = () => {
          throw new TypeError("synth.soundFontLoaded.on is not a function");
        };
      }
    }
  }
  class MidiFile {}
  class MidiHandler {
    constructor(readonly midi: MidiFile) {}
  }
  class MidiGenerator {
    constructor(
      readonly score: unknown,
      readonly settings: unknown,
      readonly handler: MidiHandler,
    ) {}
    generateSingleBeat(beat: { notes: Array<{ slideOrigin: unknown }> }) {
      generated.push(beat.notes.map((note) => note.slideOrigin));
      if (generationFails) throw new Error("generation failed");
    }
  }
  class Settings {
    player = { bufferTimeInMilliseconds: 500 };
    core = { logLevel: 0 };
  }
  const ns = {
    synth: {
      AlphaSynthWebWorkerApi: FakeSynth,
      AlphaSynthAudioWorkletOutput: WorkletOutput,
      AlphaSynthScriptProcessorOutput: ScriptOutput,
    } as Record<string, unknown>,
    midi: { MidiFile, AlphaSynthMidiFileHandler: MidiHandler, MidiFileGenerator: MidiGenerator },
    model: { SlideOutType: { Legato: 2 } },
    Settings,
  };
  return {
    ns,
    log,
    outputs,
    synths,
    generated,
    ScriptOutput,
    failGeneration: () => {
      generationFails = true;
    },
    failConstruction: () => {
      constructionFails = true;
    },
    failSubscription: () => {
      subscriptionFails = true;
    },
    /** What every context's setSinkId does from now on: resolve, reject, or wait for the test. */
    onSetSinkId: (handler: (id: string) => Promise<void>) => {
      switchSink = handler;
    },
  };
}

const OPTS = { scoreOutput: undefined, mainSettings: {}, soundFontUrl: "/sf.sf2", workletUrl: "/w.mjs", volume: 1 };
const beat = (...notes: Array<{ slideOrigin: unknown }>) => ({
  notes,
  voice: { bar: { staff: { track: { score: {} } } } },
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const deviceMissing = () => Promise.reject(new DOMException("no such device", "NotFoundError"));
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
/** What the app's output-device picker does after storing a choice. */
const announceDeviceChange = () => {
  for (const fn of listeners.get("guitarAssistant:audioSinkChanged") ?? []) fn(new Event("change"));
};

let listeners: Map<string, Set<(event: Event) => void>>;
let storage: Map<string, string>;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) })),
  );
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  });
  listeners = new Map();
  vi.stubGlobal("window", {
    isSecureContext: true,
    AudioWorkletNode: class {},
    addEventListener: (type: string, fn: (event: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: (event: Event) => void) => {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent: () => true,
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A preview synth whose soundfont has loaded and whose worklet is primed. */
async function readySynth(volume = 1, alpha = fakeAlphaTab()) {
  const preview = createPreviewSynth(alpha.ns, { ...OPTS, volume })!;
  await settle();
  alpha.synths[0].soundFontLoaded.fire();
  return { preview, alpha, synth: alpha.synths[0] };
}

describe("createPreviewSynth", () => {
  it("returns null, with one warning, when alphaTab lacks a class it needs", () => {
    const alpha = fakeAlphaTab();
    alpha.ns.synth.AlphaSynthWebWorkerApi = undefined;
    expect(createPreviewSynth(alpha.ns, OPTS)).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("returns null, with one warning, and releases the output when the synth cannot be created", () => {
    const alpha = fakeAlphaTab();
    alpha.failConstruction();
    expect(createPreviewSynth(alpha.ns, OPTS)).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(alpha.outputs).toHaveLength(1);
    expect(alpha.outputs[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("returns null, with one warning, and destroys the synth when setup fails after it exists", () => {
    const alpha = fakeAlphaTab();
    alpha.failSubscription();
    expect(createPreviewSynth(alpha.ns, OPTS)).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
    const synth = alpha.synths[0];
    expect(synth.destroy).toHaveBeenCalledTimes(1);
    // The synth owns its output: its destroy closes the output's context.
    expect(synth.output.destroy).not.toHaveBeenCalled();
  });

  it("ignores a soundfont that arrives after setup failed", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage is disabled");
      },
      setItem: () => {},
    });
    const alpha = fakeAlphaTab();
    expect(createPreviewSynth(alpha.ns, OPTS)).toBeNull();
    await settle();
    const synth = alpha.synths[0];
    expect(synth.destroy).toHaveBeenCalledTimes(1);
    expect(synth.loadSoundFont).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(listeners.get("guitarAssistant:audioSinkChanged")?.size ?? 0).toBe(0);
  });

  it("plays at the written tempo with no click and no loop", () => {
    const alpha = fakeAlphaTab();
    createPreviewSynth(alpha.ns, OPTS);
    const synth = alpha.synths[0];
    expect(synth.playbackSpeed).toBe(1);
    expect(synth.metronomeVolume).toBe(0);
    expect(synth.countInVolume).toBe(0);
    expect(synth.isLooping).toBe(false);
  });

  it("loads the soundfont as bytes — the worker cannot parse a bare ArrayBuffer", async () => {
    const alpha = fakeAlphaTab();
    createPreviewSynth(alpha.ns, OPTS);
    await settle();
    const [data, append] = alpha.synths[0].loadSoundFont.mock.calls[0];
    expect(data).toBeInstanceOf(Uint8Array);
    expect(append).toBe(false);
  });

  it("primes its own AudioContext's worklet module without playing anything", () => {
    const alpha = fakeAlphaTab();
    createPreviewSynth(alpha.ns, OPTS);
    const synth = alpha.synths[0];
    expect(synth.output.context.audioWorklet.addModule).toHaveBeenCalledWith("/w.mjs");
    expect(synth.play).not.toHaveBeenCalled();
  });

  it("does nothing until the soundfont has loaded", async () => {
    const alpha = fakeAlphaTab();
    const preview = createPreviewSynth(alpha.ns, OPTS)!;
    await settle();
    preview.play(beat({ slideOrigin: null }));
    expect(alpha.synths[0].loadMidiFile).not.toHaveBeenCalled();
  });

  it("posts the volume, then loads the beat, then plays", async () => {
    const { preview, alpha, synth } = await readySynth(0.8);
    preview.setVolume(0.3);
    expect(synth.masterVolume).toBe(1); // setVolume alone posts nothing
    preview.play(beat({ slideOrigin: null }));
    expect(alpha.log).toEqual(["loadSoundFont", "loadMidiFile@0.3", "play"]);
  });

  it("sounds the note a legato slide lands on, and puts the slide back", async () => {
    const { preview, alpha } = await readySynth();
    const legatoOrigin = { slideOutType: 2 };
    const otherOrigin = { slideOutType: 1 };
    const b = beat({ slideOrigin: legatoOrigin }, { slideOrigin: otherOrigin });
    preview.play(b);
    expect(alpha.generated[0]).toEqual([null, otherOrigin]);
    expect(b.notes[0].slideOrigin).toBe(legatoOrigin);
    expect(b.notes[1].slideOrigin).toBe(otherOrigin);
  });

  it("restores the slide and warns once when generation throws", async () => {
    const { preview, alpha, synth } = await readySynth();
    alpha.failGeneration();
    const origin = { slideOutType: 2 };
    const b = beat({ slideOrigin: origin });
    preview.play(b);
    preview.play(b);
    expect(b.notes[0].slideOrigin).toBe(origin);
    expect(synth.loadMidiFile).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("warns once and stays silent when the soundfont cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) })),
    );
    const alpha = fakeAlphaTab();
    const preview = createPreviewSynth(alpha.ns, OPTS)!;
    await settle();
    preview.play(beat({ slideOrigin: null }));
    expect(alpha.synths[0].loadSoundFont).not.toHaveBeenCalled();
    expect(alpha.synths[0].loadMidiFile).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("warns once when the synth reports the soundfont failed to load", async () => {
    const alpha = fakeAlphaTab();
    createPreviewSynth(alpha.ns, OPTS);
    await settle();
    alpha.synths[0].soundFontLoadFailed.fire(new Error("bad sf2"));
    alpha.synths[0].soundFontLoadFailed.fire(new Error("bad sf2"));
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("uses a ScriptProcessor output, with nothing to prime, when the score does", () => {
    const alpha = fakeAlphaTab();
    createPreviewSynth(alpha.ns, { ...OPTS, scoreOutput: new alpha.ScriptOutput() });
    const synth = alpha.synths[0];
    expect(synth.output).toBeInstanceOf(alpha.ScriptOutput);
    expect(synth.output.context.audioWorklet.addModule).not.toHaveBeenCalled();
  });

  it("routes its own context to the chosen device, and follows a change", async () => {
    storage.set("audioOutputDeviceId", "spk-2");
    const alpha = fakeAlphaTab();
    createPreviewSynth(alpha.ns, OPTS);
    await settle();
    const ctx = alpha.synths[0].output.context;
    expect(ctx.setSinkId).toHaveBeenCalledWith("spk-2");
    storage.set("audioOutputDeviceId", "spk-3");
    announceDeviceChange();
    await settle();
    expect(ctx.setSinkId).toHaveBeenLastCalledWith("spk-3");
  });

  it("retries a device switch that failed when the next beat is played", async () => {
    storage.set("audioOutputDeviceId", "headset");
    const alpha = fakeAlphaTab();
    alpha.onSetSinkId(deviceMissing); // the headset is not connected yet
    const { preview, synth } = await readySynth(1, alpha);
    const { setSinkId } = synth.output.context;
    expect(setSinkId).toHaveBeenCalledTimes(1);

    alpha.onSetSinkId(async () => {}); // it connects
    preview.play(beat({ slideOrigin: null }));
    await settle();
    expect(setSinkId).toHaveBeenCalledTimes(2);
    expect(setSinkId).toHaveBeenLastCalledWith("headset");
  });

  it("retries a device switch that failed when the choice is announced again", async () => {
    storage.set("audioOutputDeviceId", "headset");
    const alpha = fakeAlphaTab();
    alpha.onSetSinkId(deviceMissing);
    const { synth } = await readySynth(1, alpha);
    const { setSinkId } = synth.output.context;
    expect(setSinkId).toHaveBeenCalledTimes(1);

    alpha.onSetSinkId(async () => {});
    announceDeviceChange();
    await settle();
    expect(setSinkId).toHaveBeenCalledTimes(2);
  });

  it("does not switch again once the device has been applied", async () => {
    storage.set("audioOutputDeviceId", "spk-2");
    const { preview, synth } = await readySynth();
    const { setSinkId } = synth.output.context;
    expect(setSinkId).toHaveBeenCalledTimes(1);

    preview.play(beat({ slideOrigin: null }));
    announceDeviceChange(); // the same preference, announced again
    await settle();
    expect(setSinkId).toHaveBeenCalledTimes(1);
  });

  it("does not start a second switch while the first is still on its way", async () => {
    storage.set("audioOutputDeviceId", "headset");
    const alpha = fakeAlphaTab();
    const slow = deferred();
    alpha.onSetSinkId(() => slow.promise);
    const { preview, synth } = await readySynth(1, alpha);
    const { setSinkId } = synth.output.context;
    expect(setSinkId).toHaveBeenCalledTimes(1);

    preview.play(beat({ slideOrigin: null }));
    announceDeviceChange();
    await settle();
    expect(setSinkId).toHaveBeenCalledTimes(1);

    slow.resolve();
    await settle();
    preview.play(beat({ slideOrigin: null }));
    await settle();
    expect(setSinkId).toHaveBeenCalledTimes(1);
  });

  it("a switch that fails after a newer choice was made does not make that choice forget itself", async () => {
    storage.set("audioOutputDeviceId", "headset-1");
    const alpha = fakeAlphaTab();
    const late = deferred();
    alpha.onSetSinkId((id) => (id === "headset-1" ? late.promise : Promise.resolve()));
    const { synth } = await readySynth(1, alpha);
    const { setSinkId } = synth.output.context;

    storage.set("audioOutputDeviceId", "headset-2");
    announceDeviceChange();
    await settle();
    expect(setSinkId.mock.calls.map(([id]) => id)).toEqual(["headset-1", "headset-2"]);

    late.reject(new DOMException("no such device", "NotFoundError")); // the first one gives up, late
    await settle();
    announceDeviceChange();
    await settle();
    expect(setSinkId).toHaveBeenCalledTimes(2);
  });

  it("destroy shuts the synth down once and ignores everything after", async () => {
    const { preview, synth } = await readySynth();
    preview.destroy();
    expect(synth.destroy).toHaveBeenCalledTimes(1);
    expect(listeners.get("guitarAssistant:audioSinkChanged")?.size ?? 0).toBe(0);
    preview.play(beat({ slideOrigin: null }));
    preview.stop();
    preview.setVolume(0.2);
    preview.destroy();
    expect(synth.loadMidiFile).not.toHaveBeenCalled();
    expect(synth.stop).not.toHaveBeenCalled();
    expect(synth.destroy).toHaveBeenCalledTimes(1);
  });

  it("ignores a soundfont that arrives after destroy", async () => {
    const alpha = fakeAlphaTab();
    const preview = createPreviewSynth(alpha.ns, OPTS)!;
    preview.destroy();
    await settle();
    expect(alpha.synths[0].loadSoundFont).not.toHaveBeenCalled();
  });

  it("setSoundFontUrl loads a new bank with append=false and remembers it", async () => {
    const alpha = fakeAlphaTab();
    const preview = createPreviewSynth(alpha.ns, OPTS)!;
    await settle();
    expect(alpha.synths[0].loadSoundFont).toHaveBeenCalledTimes(1); // initial bank
    preview.setSoundFontUrl("/other.sf2");
    await settle();
    expect(alpha.synths[0].loadSoundFont).toHaveBeenCalledTimes(2);
    const [bytes, append] = alpha.synths[0].loadSoundFont.mock.calls[1];
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(append).toBe(false); // replace the bank, not stack another on top
  });

  it("setSoundFontUrl ignores a repeat of the loaded bank", async () => {
    const alpha = fakeAlphaTab();
    const preview = createPreviewSynth(alpha.ns, OPTS)!;
    await settle();
    preview.setSoundFontUrl(OPTS.soundFontUrl);
    await settle();
    expect(alpha.synths[0].loadSoundFont).toHaveBeenCalledTimes(1); // only the initial load
  });

  it("setSoundFontUrl keeps the old bank when the new one cannot be fetched", async () => {
    const alpha = fakeAlphaTab();
    const preview = createPreviewSynth(alpha.ns, OPTS)!;
    await settle();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) })),
    );
    preview.setSoundFontUrl("/missing.sf2");
    await settle();
    expect(alpha.synths[0].loadSoundFont).toHaveBeenCalledTimes(1); // the initial bank only
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("setSoundFontUrl ignores a superseded fetch that finishes late", async () => {
    const alpha = fakeAlphaTab();
    const preview = createPreviewSynth(alpha.ns, OPTS)!;
    await settle();
    let slowResolve: (value: { ok: boolean; status: number; arrayBuffer: () => Promise<ArrayBuffer> }) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/slow.sf2"
          ? new Promise((resolve) => {
              slowResolve = resolve;
            })
          : Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }),
      ),
    );
    preview.setSoundFontUrl("/slow.sf2");
    preview.setSoundFontUrl("/fast.sf2"); // picker moved on before the slow fetch finished
    await settle();
    expect(alpha.synths[0].loadSoundFont).toHaveBeenCalledTimes(2); // initial + fast only
    slowResolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) });
    await settle();
    expect(alpha.synths[0].loadSoundFont).toHaveBeenCalledTimes(2); // the slow one never lands
  });
});
