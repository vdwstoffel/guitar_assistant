// Shared audio output preference — persisted in localStorage and broadcast via
// a window CustomEvent so every player (BottomPlayer WaveSurfer, AlphaTab-based
// tab practice) can react to changes.

export const DEFAULT_DEVICE_ID = "default";
// Legacy preference value from when the app defaulted to a "Spark 2" device.
// Normalized to the system default on read so old saved settings still work.
const LEGACY_AUTO_SPARK_ID = "auto-spark";
const STORAGE_KEY = "audioOutputDeviceId";
const CHANGE_EVENT = "guitarAssistant:audioSinkChanged";

type AudioContextWithSink = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
  sinkId?: string;
};

function normalizePref(stored: string | null): string {
  if (!stored || stored === LEGACY_AUTO_SPARK_ID) return DEFAULT_DEVICE_ID;
  return stored;
}

export function getAudioSinkPreference(): string {
  if (typeof window === "undefined") return DEFAULT_DEVICE_ID;
  return normalizePref(localStorage.getItem(STORAGE_KEY));
}

export function setAudioSinkPreference(pref: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, pref);
  window.dispatchEvent(new CustomEvent<string>(CHANGE_EVENT, { detail: pref }));
}

export function subscribeToAudioSinkChanges(cb: (pref: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<string>).detail);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

// Resolve the stored preference to an actual audio-output deviceId. The stored
// value is already a concrete deviceId or "default"; legacy values map to default.
export async function resolveDeviceId(pref: string): Promise<string> {
  return pref === LEGACY_AUTO_SPARK_ID ? DEFAULT_DEVICE_ID : pref;
}

// Apply the sink to a Web Audio AudioContext. Chrome quirk: setSinkId on an
// already-running graph with a MediaElementAudioSource in the chain requires
// disconnecting and reconnecting the tail node to force re-plumbing.
export async function applyAudioContextSink(
  ctx: AudioContext | null,
  tailNode: AudioNode | null,
  pref: string,
): Promise<void> {
  const ctxWithSink = ctx as AudioContextWithSink | null;
  if (!ctxWithSink || typeof ctxWithSink.setSinkId !== "function") return;
  const deviceId = await resolveDeviceId(pref);
  try {
    if (tailNode) tailNode.disconnect(ctxWithSink.destination);
    await ctxWithSink.setSinkId(deviceId);
    if (tailNode) tailNode.connect(ctxWithSink.destination);
  } catch (err) {
    console.warn("AudioContext.setSinkId failed", err);
    if (tailNode) {
      try {
        tailNode.connect(ctxWithSink.destination);
      } catch {
        /* ignore */
      }
    }
  }
}

// Apply the sink to an AlphaTab synth output via its native setOutputDevice API.
// `output` is `api.player.output` (an ISynthOutput). We find the matching
// ISynthOutputDevice by deviceId, then call setOutputDevice.
type AlphaTabOutputDevice = { deviceId: string; isDefault?: boolean };
type AlphaTabOutput = {
  enumerateOutputDevices?: () => Promise<AlphaTabOutputDevice[]>;
  setOutputDevice?: (device: AlphaTabOutputDevice | null) => Promise<void>;
};

export async function applyAlphaTabSink(
  output: unknown,
  pref: string,
): Promise<void> {
  const o = output as AlphaTabOutput | null | undefined;
  if (!o?.enumerateOutputDevices || !o.setOutputDevice) return;
  const deviceId = await resolveDeviceId(pref);
  try {
    if (deviceId === DEFAULT_DEVICE_ID) {
      await o.setOutputDevice(null);
      return;
    }
    const devices = await o.enumerateOutputDevices();
    const match = devices.find((d) => d.deviceId === deviceId);
    if (match) {
      await o.setOutputDevice(match);
    } else {
      // Requested device not enumerated by AlphaTab — fall back to default.
      await o.setOutputDevice(null);
    }
  } catch (err) {
    console.warn("AlphaTab setOutputDevice failed", err);
  }
}

// ---------------------------------------------------------------------------
// Input (microphone) device preference — mirrors the output side above.
// ---------------------------------------------------------------------------

const INPUT_STORAGE_KEY = "audioInputDeviceId";
const INPUT_CHANGE_EVENT = "guitarAssistant:audioInputChanged";

export function getAudioInputPreference(): string {
  if (typeof window === "undefined") return DEFAULT_DEVICE_ID;
  return normalizePref(localStorage.getItem(INPUT_STORAGE_KEY));
}

export function setAudioInputPreference(pref: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INPUT_STORAGE_KEY, pref);
  window.dispatchEvent(new CustomEvent<string>(INPUT_CHANGE_EVENT, { detail: pref }));
}

export function subscribeToAudioInputChanges(cb: (pref: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<string>).detail);
  window.addEventListener(INPUT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(INPUT_CHANGE_EVENT, handler);
}

// Resolve the stored input preference to a concrete deviceId, or null when the
// selection means "system default" (so callers omit the deviceId constraint).
export async function resolveInputDeviceId(pref: string): Promise<string | null> {
  if (pref === DEFAULT_DEVICE_ID || pref === LEGACY_AUTO_SPARK_ID) return null;
  return pref;
}

// Merge the globally selected input device into a getUserMedia audio constraint.
// Returns `base` unchanged when the selection resolves to system default.
export async function withInputDevice(
  base: MediaTrackConstraints = {},
): Promise<MediaTrackConstraints> {
  const id = await resolveInputDeviceId(getAudioInputPreference());
  if (!id) return base;
  return { ...base, deviceId: { exact: id } };
}

// ---------------------------------------------------------------------------
// Output routing helpers usable by any Web Audio context or media element.
// ---------------------------------------------------------------------------

// Route a plain Web Audio context (oscillator-based sources: metronomes, click
// and note generators) to the selected output. Best-effort; no-op when unsupported.
export async function routeContextToSink(ctx: AudioContext | null): Promise<void> {
  const ctxWithSink = ctx as AudioContextWithSink | null;
  if (!ctxWithSink || typeof ctxWithSink.setSinkId !== "function") return;
  try {
    await ctxWithSink.setSinkId(await resolveDeviceId(getAudioSinkPreference()));
  } catch (err) {
    console.warn("routeContextToSink failed", err);
  }
}

type MediaElementWithSink = HTMLMediaElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

// Route an HTMLMediaElement (<video>, WaveSurfer's <audio>) to the selected output.
export async function routeMediaElementToSink(el: HTMLMediaElement | null): Promise<void> {
  const elWithSink = el as MediaElementWithSink | null;
  if (!elWithSink || typeof elWithSink.setSinkId !== "function") return;
  try {
    await elWithSink.setSinkId(await resolveDeviceId(getAudioSinkPreference()));
  } catch (err) {
    console.warn("routeMediaElementToSink failed", err);
  }
}
