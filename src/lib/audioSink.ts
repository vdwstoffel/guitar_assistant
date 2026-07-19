// Shared audio output preference — persisted in localStorage and broadcast via
// a window CustomEvent so every player (BottomPlayer WaveSurfer, AlphaTab-based
// tab practice) can react to changes.

export const AUTO_SPARK_ID = "auto-spark";
export const DEFAULT_DEVICE_ID = "default";
const SPARK_LABEL_RE = /spark\s*2/i;
const STORAGE_KEY = "audioOutputDeviceId";
const CHANGE_EVENT = "guitarAssistant:audioSinkChanged";

type AudioContextWithSink = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
  sinkId?: string;
};

export function getAudioSinkPreference(): string {
  if (typeof window === "undefined") return AUTO_SPARK_ID;
  return localStorage.getItem(STORAGE_KEY) || AUTO_SPARK_ID;
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

// Resolve the stored preference to an actual audio-output deviceId.
// AUTO_SPARK_ID → the Spark 2's deviceId if plugged in, otherwise "default".
export async function resolveDeviceId(pref: string): Promise<string> {
  if (pref !== AUTO_SPARK_ID) return pref;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const spark = devices.find(
      (d) => d.kind === "audiooutput" && SPARK_LABEL_RE.test(d.label),
    );
    return spark?.deviceId ?? DEFAULT_DEVICE_ID;
  } catch {
    return DEFAULT_DEVICE_ID;
  }
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
