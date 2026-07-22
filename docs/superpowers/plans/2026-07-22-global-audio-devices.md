# Global Audio Input/Output Device Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app's selected audio **output** device apply to every routable sound source, and add a global **input** device selection that applies to all microphone capture, controlled from one picker in the top nav.

**Architecture:** Keep [audioSink.ts](../../../src/lib/audioSink.ts) as the single source of truth (localStorage + custom-event broadcast). Extend it with a parallel input preference and small shared helpers (`routeContextToSink`, `routeMediaElementToSink`, `withInputDevice`). Every sound source subscribes and applies; every `getUserMedia` call merges the global input device. The picker moves to the top nav and covers both output and input.

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5. Web Audio API `AudioContext.setSinkId`, `HTMLMediaElement.setSinkId`, `MediaTrackConstraints.deviceId` (all Chromium-only; best-effort with graceful fallback). WaveSurfer.js for recording playback.

## Global Constraints

- No unit-test framework is installed. All audio code touches browser-only APIs (`navigator.mediaDevices`, `localStorage`, `AudioContext`) that don't run under Node, so verification is `npx tsc --noEmit` (filter `generated/prisma`) plus manual in-browser checks. There are NO throwaway Node scripts in this plan.
- Do NOT run Prisma commands or `npm run build` locally (Docker owns `.next/` and `src/generated/prisma/`).
- Every `setSinkId` / device call must be wrapped so an unsupported browser or a missing device falls back to system default silently (never throw to the UI).
- Sharp/existing sentinels: `AUTO_SPARK_ID = "auto-spark"`, `DEFAULT_DEVICE_ID = "default"`, Spark label regex `/spark\s*2/i` — reuse these, do not redefine.
- The embedded YouTube iframe is NOT routable and is intentionally left on system default (no code, no warning UI).
- Commit after each task. Work happens on branch `feat/global-audio-devices`.

---

## File Structure

- `src/lib/audioSink.ts` — **modify**: add input-preference API + `resolveInputDeviceId` + `withInputDevice` + `routeContextToSink` + `routeMediaElementToSink`. (Existing output API unchanged.)
- `src/lib/clickGenerator.ts`, `src/lib/audioGenerator.ts` — **modify**: route their singleton `AudioContext` + subscribe to output changes.
- `src/components/Metronome.tsx`, `src/components/TopNav.tsx` — **modify**: route metronome `AudioContext`; TopNav also hosts the picker (Task 6) and the recorder panel (Task 5).
- `src/components/Videos.tsx`, `src/components/VideoPlayer.tsx` — **modify**: `setSinkId` on the local `<video>` element.
- `src/components/RecordingWaveform.tsx` — **modify**: route the WaveSurfer media element to the sink.
- `src/hooks/useAudioRecorder.ts` — **modify**: consume the global input device; drop the local device-list state.
- `src/components/RecordingsView.tsx` — **modify**: drop the recorder's local device `<select>`.
- `src/components/NoteTrainer/useNoteTrainer.ts`, `src/components/Tuner.tsx` — **modify**: capture from the global input device.
- `src/components/AudioOutputPicker.tsx` — **modify**: becomes a combined output+input picker.
- `src/components/BottomPlayer.tsx` — **modify**: remove the in-player picker; subscribe to external sink changes.

---

## Task 1: Extend `audioSink.ts` with input preference + shared helpers

**Files:**
- Modify: `src/lib/audioSink.ts` (append new exports; do not change existing ones)

**Interfaces:**
- Consumes (existing in file): `AUTO_SPARK_ID`, `DEFAULT_DEVICE_ID`, `SPARK_LABEL_RE`, `resolveDeviceId`, `getAudioSinkPreference`, `AudioContextWithSink`.
- Produces:
  - `getAudioInputPreference(): string`
  - `setAudioInputPreference(pref: string): void`
  - `subscribeToAudioInputChanges(cb: (pref: string) => void): () => void`
  - `resolveInputDeviceId(pref: string): Promise<string | null>` (null = system default / omit constraint)
  - `withInputDevice(base?: MediaTrackConstraints): Promise<MediaTrackConstraints>`
  - `routeContextToSink(ctx: AudioContext | null): Promise<void>`
  - `routeMediaElementToSink(el: HTMLMediaElement | null): Promise<void>`

- [ ] **Step 1: Add the input preference + helpers**

Append to the end of `src/lib/audioSink.ts`:

```ts
// ---------------------------------------------------------------------------
// Input (microphone) device preference — mirrors the output side above.
// ---------------------------------------------------------------------------

const INPUT_STORAGE_KEY = "audioInputDeviceId";
const INPUT_CHANGE_EVENT = "guitarAssistant:audioInputChanged";

export function getAudioInputPreference(): string {
  if (typeof window === "undefined") return AUTO_SPARK_ID;
  return localStorage.getItem(INPUT_STORAGE_KEY) || AUTO_SPARK_ID;
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
// AUTO_SPARK_ID → the Spark 2 input deviceId if present, otherwise null.
export async function resolveInputDeviceId(pref: string): Promise<string | null> {
  if (pref === DEFAULT_DEVICE_ID) return null;
  if (pref !== AUTO_SPARK_ID) return pref;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const spark = devices.find(
      (d) => d.kind === "audioinput" && SPARK_LABEL_RE.test(d.label),
    );
    return spark?.deviceId ?? null;
  } catch {
    return null;
  }
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
```

- [ ] **Step 2: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "audioSink" || echo "no audioSink type errors"`
Expected: `no audioSink type errors`

- [ ] **Step 3: Commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
git add src/lib/audioSink.ts
git commit -m "feat(audio): add global input preference and shared routing helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Route the Web Audio singletons (clicks, notes/chords/intervals)

**Files:**
- Modify: `src/lib/clickGenerator.ts`
- Modify: `src/lib/audioGenerator.ts`

**Interfaces:**
- Consumes: `routeContextToSink`, `subscribeToAudioSinkChanges` from `@/lib/audioSink` (Task 1 / existing).

Both modules lazily create a singleton `AudioContext` in a `getAudioContext()` function. We route it once on creation and re-route whenever the output preference changes. A module-level flag prevents stacking subscriptions.

- [ ] **Step 1: Route the clickGenerator context**

In `src/lib/clickGenerator.ts`, add an import at the top (after the file's opening comment block, before `let audioContext`):

```ts
import { routeContextToSink, subscribeToAudioSinkChanges } from "./audioSink";
```

Add a module-level flag next to the singleton:

```ts
let audioContext: AudioContext | null = null;
let sinkRoutingSetup = false;
```

Replace the body of `getAudioContext()` with:

```ts
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (!sinkRoutingSetup) {
    sinkRoutingSetup = true;
    const ctx = audioContext;
    void routeContextToSink(ctx);
    subscribeToAudioSinkChanges(() => void routeContextToSink(ctx));
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}
```

- [ ] **Step 2: Route the audioGenerator context**

In `src/lib/audioGenerator.ts`, add to the existing import from `./musicTheory` a NEW import line just below it:

```ts
import { routeContextToSink, subscribeToAudioSinkChanges } from './audioSink';
```

Add the flag next to the singleton:

```ts
let audioContext: AudioContext | null = null;
let sinkRoutingSetup = false;
```

Replace the body of the exported `getAudioContext()` with:

```ts
export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (!sinkRoutingSetup) {
    sinkRoutingSetup = true;
    const ctx = audioContext;
    void routeContextToSink(ctx);
    subscribeToAudioSinkChanges(() => void routeContextToSink(ctx));
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}
```

- [ ] **Step 3: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "clickGenerator|audioGenerator" || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 4: Commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
git add src/lib/clickGenerator.ts src/lib/audioGenerator.ts
git commit -m "feat(audio): route count-in and note/chord generators to selected output

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Route both metronomes to the selected output

**Files:**
- Modify: `src/components/Metronome.tsx`
- Modify: `src/components/TopNav.tsx`

**Interfaces:**
- Consumes: `routeContextToSink`, `subscribeToAudioSinkChanges` from `@/lib/audioSink`.

Each metronome creates its `AudioContext` in `startMetronome`. Route it right after creation/resume, and add an effect that re-routes the live context when the preference changes.

- [ ] **Step 1: Route the standalone Metronome context**

In `src/components/Metronome.tsx`, add to the imports:

```tsx
import { routeContextToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
```

In `startMetronome`, immediately after the `if (audioContextRef.current.state === 'suspended') { audioContextRef.current.resume(); }` block and before `currentBeatRef.current = 0;`, insert:

```tsx
    void routeContextToSink(audioContextRef.current);
```

Add this effect alongside the other `useEffect`s (e.g. right after the `timeSignature` effect near the top of the component):

```tsx
  useEffect(() => {
    return subscribeToAudioSinkChanges(() => {
      void routeContextToSink(audioContextRef.current);
    });
  }, []);
```

- [ ] **Step 2: Route the TopNav metronome context**

In `src/components/TopNav.tsx`, add `routeContextToSink` and `subscribeToAudioSinkChanges` to the imports (a new import line):

```tsx
import { routeContextToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
```

In `startMetronome` (around line 118), after the suspended/resume block and before `currentBeatRef.current = 0;`, insert:

```tsx
    void routeContextToSink(audioContextRef.current);
```

Add this effect near TopNav's other effects (e.g. right after the metronome-related state/refs, inside the component body):

```tsx
  useEffect(() => {
    return subscribeToAudioSinkChanges(() => {
      void routeContextToSink(audioContextRef.current);
    });
  }, []);
```

- [ ] **Step 3: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "Metronome|TopNav" || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 4: Commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
git add src/components/Metronome.tsx src/components/TopNav.tsx
git commit -m "feat(audio): route metronomes to selected output device

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Route media elements (local video, recording playback)

**Files:**
- Modify: `src/components/Videos.tsx`
- Modify: `src/components/VideoPlayer.tsx`
- Modify: `src/components/RecordingWaveform.tsx`

**Interfaces:**
- Consumes: `routeMediaElementToSink`, `subscribeToAudioSinkChanges` from `@/lib/audioSink`.

- [ ] **Step 1: Route the local `<video>` in Videos.tsx**

In `src/components/Videos.tsx`, add to the imports:

```tsx
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
```

The local video element uses `ref={htmlVideoRef}` and fires `onLoadedMetadata`. In its existing `onLoadedMetadata` handler, after the volume-restore line, add a routing call. Change the handler to:

```tsx
                  onLoadedMetadata={(e) => {
                    const saved = localStorage.getItem("youtubeLocalVolume");
                    if (saved !== null) e.currentTarget.volume = parseFloat(saved);
                    void routeMediaElementToSink(e.currentTarget);
                  }}
```

Add an effect (near the component's other effects) that re-routes the current video when the preference changes:

```tsx
  useEffect(() => {
    return subscribeToAudioSinkChanges(() => {
      void routeMediaElementToSink(htmlVideoRef.current);
    });
  }, []);
```

- [ ] **Step 2: Route the `<video>` in VideoPlayer.tsx**

In `src/components/VideoPlayer.tsx`, add to the imports:

```tsx
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
```

Add an effect that routes on mount and on preference change (place it after the existing effects that reference `videoRef`):

```tsx
  useEffect(() => {
    void routeMediaElementToSink(videoRef.current);
    return subscribeToAudioSinkChanges(() => {
      void routeMediaElementToSink(videoRef.current);
    });
  }, []);
```

- [ ] **Step 3: Route the RecordingWaveform playback**

In `src/components/RecordingWaveform.tsx`, add to the imports:

```tsx
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
```

In the `WaveSurfer.create(...)` effect, the instance exposes its underlying `<audio>` via `ws.getMediaElement()`. In the existing `ws.on("ready", ...)` handler, also route the element, and add a sink subscription that is cleaned up with the instance. Replace the `ws.on("ready", ...)` line and the return cleanup with:

```tsx
      ws.on("ready", () => {
        void routeMediaElementToSink(ws.getMediaElement());
        callbacksRef.current.onReady?.(ws.getDuration());
      });
      ws.on("play", () => callbacksRef.current.onPlay?.());
      ws.on("pause", () => callbacksRef.current.onPause?.());
      ws.on("finish", () => callbacksRef.current.onFinish?.());

      const unsubscribeSink = subscribeToAudioSinkChanges(() => {
        void routeMediaElementToSink(ws.getMediaElement());
      });

      return () => {
        unsubscribeSink();
        try {
          ws.destroy();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      };
```

- [ ] **Step 4: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "Videos|VideoPlayer|RecordingWaveform" || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 5: Commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
git add src/components/Videos.tsx src/components/VideoPlayer.tsx src/components/RecordingWaveform.tsx
git commit -m "feat(audio): route local video and recording playback to selected output

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Capture from the global input device (recorder, tuner, note trainer)

**Files:**
- Modify: `src/hooks/useAudioRecorder.ts`
- Modify: `src/components/TopNav.tsx`
- Modify: `src/components/RecordingsView.tsx`
- Modify: `src/components/NoteTrainer/useNoteTrainer.ts`
- Modify: `src/components/Tuner.tsx`

**Interfaces:**
- Consumes: `withInputDevice`, `subscribeToAudioInputChanges` from `@/lib/audioSink`.
- Produces (changed hook API): `useAudioRecorder()` no longer returns `devices`, `selectedDeviceId`, `setSelectedDeviceId`, or `refreshDevices`. It still returns `status`, `error`, `requestPermission`, `permissionGranted`, `durationMs`, `level`, `start`, `stop`.

The recorder currently enumerates its own input devices and holds a local `selectedDeviceId`. That local picker is replaced by the global input preference; the two UIs that rendered its device `<select>` (TopNav recorder panel, RecordingsView) drop that control.

- [ ] **Step 1: Make `useAudioRecorder` use the global input device**

In `src/hooks/useAudioRecorder.ts`:

Add the import:

```ts
import { withInputDevice, subscribeToAudioInputChanges } from "@/lib/audioSink";
```

Remove the local device state and enumeration. Delete these pieces:
- the `devices` state and `selectedDeviceId` state (and their `useState` declarations),
- the entire `refreshDevices` `useCallback`,
- the `useEffect` that calls `refreshDevices()` and adds the `devicechange` listener (lines ~106-115).

Simplify `requestPermission` to just probe for permission (no `refreshDevices` call):

```ts
  const requestPermission = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access requires a secure (HTTPS) origin.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissionGranted(true);
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setError(err instanceof Error ? err.message : "Microphone permission denied");
    }
  }, []);
```

In `start()`, replace the constraint-building block:

```ts
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
        sampleSize: 16,
      };
      if (selectedDeviceId) audioConstraints.deviceId = { exact: selectedDeviceId };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;

      // After first permission grant, labels become available; refresh list.
      refreshDevices();
```

with:

```ts
      const audioConstraints = await withInputDevice({
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
        sampleSize: 16,
      });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;
```

Update the `start` `useCallback` dependency array: remove `selectedDeviceId` and `refreshDevices`, leaving `[cleanupStream]`.

Update the returned object to drop the removed fields:

```ts
  return {
    status,
    error,
    requestPermission,
    permissionGranted,
    durationMs,
    level,
    start,
    stop,
  };
```

- [ ] **Step 2: Update the TopNav recorder panel**

In `src/components/TopNav.tsx`, in the "Mini Recorder Panel" block (around lines 608-665), remove the device-picker `<div>` that contains the `<select value={recorder.selectedDeviceId ...}>` and its mic-icon SVG, but KEEP the "Grant access" button (gated on `!recorder.permissionGranted`). Replace the whole `{/* Device picker */}` container `<div className="flex-1 min-w-0 flex items-center gap-2">...</div>` with just the grant-access affordance:

```tsx
            {/* Mic permission (device is chosen via the global Audio Settings picker) */}
            {!recorder.permissionGranted && (
              <button
                onClick={() => recorder.requestPermission()}
                disabled={recorder.status === 'recording'}
                className="px-2 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white shrink-0"
                title="Grant microphone access"
              >
                Grant access
              </button>
            )}
```

In the Record/Stop button's `disabled` expression, remove the `|| recorder.devices.length === 0` clause:

```tsx
              disabled={recorderUploading || recorder.status === 'requesting' || recorder.status === 'stopping'}
```

- [ ] **Step 3: Update RecordingsView**

In `src/components/RecordingsView.tsx`, remove the recorder device `<select>` block (the element bound to `recorder.selectedDeviceId` / `recorder.setSelectedDeviceId` / `recorder.devices`, around lines 145-165) and the `recorder.refreshDevices()` button. Keep the `{!recorder.permissionGranted && (...)}` grant-access button. In the record button's `disabled` expression (around line 185), remove the `|| recorder.devices.length === 0` clause so it reads:

```tsx
              disabled={isBusy}
```

(If the grant-access button referenced removed handlers, leave only `recorder.requestPermission`.)

- [ ] **Step 4: Capture from the global input in NoteTrainer**

In `src/components/NoteTrainer/useNoteTrainer.ts`, add the import:

```ts
import { withInputDevice } from "@/lib/audioSink";
```

Replace the `getUserMedia` call (around line 179):

```ts
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
```

with:

```ts
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: await withInputDevice({
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }),
      });
```

- [ ] **Step 5: Capture from the global input in the Tuner**

In `src/components/Tuner.tsx`, add the import:

```tsx
import { withInputDevice } from "@/lib/audioSink";
```

Replace the `getUserMedia` call in `start` (around line 87) the same way:

```tsx
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: await withInputDevice({
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }),
      });
```

- [ ] **Step 6: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "useAudioRecorder|TopNav|RecordingsView|useNoteTrainer|Tuner" || echo "no type errors"`
Expected: `no type errors`. If tsc reports remaining references to `recorder.devices` / `selectedDeviceId` / `setSelectedDeviceId` / `refreshDevices`, remove them — those are the consumers that must be updated.

- [ ] **Step 7: Commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
git add src/hooks/useAudioRecorder.ts src/components/TopNav.tsx src/components/RecordingsView.tsx src/components/NoteTrainer/useNoteTrainer.ts src/components/Tuner.tsx
git commit -m "feat(audio): capture all mic input from the global input device

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Combined output+input picker in the top nav

**Files:**
- Modify: `src/components/AudioOutputPicker.tsx`
- Modify: `src/components/TopNav.tsx`
- Modify: `src/components/BottomPlayer.tsx`

**Interfaces:**
- Consumes: `getAudioSinkPreference`, `setAudioSinkPreference`, `subscribeToAudioSinkChanges`, `getAudioInputPreference`, `setAudioInputPreference`, `subscribeToAudioInputChanges` from `@/lib/audioSink`.
- Produces: `AudioOutputPicker` now takes `{ outputDeviceId, onOutputChange, inputDeviceId, onInputChange }` and renders both an Output and an Input section.

The existing picker is a portal dropdown that lists `audiooutput` devices. Generalize it to also list `audioinput` devices with the same Auto-Spark / System-default options, and wire it in the top nav bound to both preferences. Remove the copy from BottomPlayer, and make BottomPlayer subscribe to external output changes so its own routing stays in sync.

- [ ] **Step 1: Generalize the picker to output + input**

In `src/components/AudioOutputPicker.tsx`, replace the props interface:

```tsx
interface AudioOutputPickerProps {
  outputDeviceId: string;
  onOutputChange: (deviceId: string) => void;
  inputDeviceId: string;
  onInputChange: (deviceId: string) => void;
}
```

Change the component signature and enumerate both kinds. Update the `useState` for devices to hold all devices, and derive output/input lists:

```tsx
export default function AudioOutputPicker({
  outputDeviceId,
  onOutputChange,
  inputDeviceId,
  onInputChange,
}: AudioOutputPickerProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
```

In the enumeration effect, keep all devices instead of filtering to outputs:

```tsx
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        if (cancelled) return;
        setDevices(all);
        const outputs = all.filter((d) => d.kind === "audiooutput");
        setLabelsHidden(outputs.some((d) => !d.label) || outputs.length < 2);
      })
      .catch((err) => console.warn("enumerateDevices failed", err));
```

Extract the repeated list-of-buttons markup into a local helper component defined in the same file, so Output and Input render identically without duplicating the block:

```tsx
function DeviceSection({
  title,
  kind,
  devices,
  selectedId,
  onSelect,
}: {
  title: string;
  kind: "audiooutput" | "audioinput";
  devices: MediaDeviceInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const sparkDevice = devices.find(
    (d) => d.kind === kind && SPARK_LABEL_RE.test(d.label) && d.deviceId !== COMMUNICATIONS_DEVICE_ID,
  );
  const visible = devices.filter(
    (d) =>
      d.kind === kind &&
      d.deviceId &&
      d.deviceId !== DEFAULT_DEVICE_ID &&
      d.deviceId !== COMMUNICATIONS_DEVICE_ID,
  );
  return (
    <>
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-700">
        {title}
      </div>
      <button
        role="option"
        aria-selected={selectedId === AUTO_SPARK_ID}
        onClick={() => onSelect(AUTO_SPARK_ID)}
        className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-700 ${
          selectedId === AUTO_SPARK_ID ? "text-green-400" : "text-gray-200"
        }`}
      >
        <span className="w-3 inline-block">{selectedId === AUTO_SPARK_ID ? "✓" : ""}</span>
        <span className="flex-1 truncate">
          Auto{sparkDevice ? " → Spark 2" : " (Spark 2 not detected)"}
        </span>
      </button>
      <button
        role="option"
        aria-selected={selectedId === DEFAULT_DEVICE_ID}
        onClick={() => onSelect(DEFAULT_DEVICE_ID)}
        className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-700 ${
          selectedId === DEFAULT_DEVICE_ID ? "text-green-400" : "text-gray-200"
        }`}
      >
        <span className="w-3 inline-block">{selectedId === DEFAULT_DEVICE_ID ? "✓" : ""}</span>
        System default
      </button>
      {visible.map((d) => (
        <button
          key={d.deviceId}
          role="option"
          aria-selected={d.deviceId === selectedId}
          onClick={() => onSelect(d.deviceId)}
          className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-700 ${
            d.deviceId === selectedId ? "text-green-400" : "text-gray-200"
          }`}
        >
          <span className="w-3 inline-block">{d.deviceId === selectedId ? "✓" : ""}</span>
          <span className="truncate">{d.label || "Unnamed device"}</span>
        </button>
      ))}
    </>
  );
}
```

Replace the dropdown's inner markup (the single "Audio output" header + the three output button blocks) so it renders both sections, keeping the existing "Enable full device list" footer:

```tsx
            <DeviceSection
              title="Audio output"
              kind="audiooutput"
              devices={devices}
              selectedId={outputDeviceId}
              onSelect={(id) => { onOutputChange(id); }}
            />
            <DeviceSection
              title="Audio input"
              kind="audioinput"
              devices={devices}
              selectedId={inputDeviceId}
              onSelect={(id) => { onInputChange(id); }}
            />
```

Update the trigger button's `title`/`aria-label` to reflect both (e.g. `aria-label="Choose audio input and output devices"`). The `selectedLabel` variable used only for the button `title` can be simplified to a static "Audio devices" string:

```tsx
      <button
        ref={buttonRef}
        onClick={() => {
          setOpen((v) => !v);
          setRefreshTick((n) => n + 1);
        }}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        title="Audio input / output devices"
        aria-label="Choose audio input and output devices"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
```

Remove the now-unused `selectedLabel`, `sparkDevice`, and `visibleDevices` computations from the component body (they moved into `DeviceSection`).

- [ ] **Step 2: Render the picker in TopNav bound to both preferences**

In `src/components/TopNav.tsx`, add imports:

```tsx
import AudioOutputPicker from "./AudioOutputPicker";
import {
  getAudioSinkPreference,
  setAudioSinkPreference,
  subscribeToAudioSinkChanges,
  getAudioInputPreference,
  setAudioInputPreference,
  subscribeToAudioInputChanges,
} from "@/lib/audioSink";
```

(Merge with the `routeContextToSink`/`subscribeToAudioSinkChanges` import added in Task 3 — a single import statement listing all needed names is fine.)

Add state near the top of the component:

```tsx
  const [outputDeviceId, setOutputDeviceId] = useState<string>(() =>
    typeof window !== "undefined" ? getAudioSinkPreference() : "auto-spark",
  );
  const [inputDeviceId, setInputDeviceId] = useState<string>(() =>
    typeof window !== "undefined" ? getAudioInputPreference() : "auto-spark",
  );

  useEffect(() => {
    const unsubOut = subscribeToAudioSinkChanges(setOutputDeviceId);
    const unsubIn = subscribeToAudioInputChanges(setInputDeviceId);
    return () => { unsubOut(); unsubIn(); };
  }, []);
```

Render the picker in the top-nav toolbar (next to the Metronome/Tuner/Recorder buttons — place it in the same button cluster):

```tsx
          <AudioOutputPicker
            outputDeviceId={outputDeviceId}
            onOutputChange={(id) => { setOutputDeviceId(id); setAudioSinkPreference(id); }}
            inputDeviceId={inputDeviceId}
            onInputChange={(id) => { setInputDeviceId(id); setAudioInputPreference(id); }}
          />
```

- [ ] **Step 3: Remove the in-player picker and keep BottomPlayer in sync**

In `src/components/BottomPlayer.tsx`:

Remove the import `import AudioOutputPicker from "./AudioOutputPicker";` (line 11).

Add `subscribeToAudioSinkChanges` to the existing `@/lib/audioSink` import block (which currently imports `applyAudioContextSink`, `getAudioSinkPreference`, `setAudioSinkPreference`).

Remove the `<AudioOutputPicker deviceId={audioOutputDeviceId} onChange={setAudioOutputDeviceId} />` element (lines ~1318-1321).

Since the in-player control is gone, keep `audioOutputDeviceId` state (still drives the routing effect) but replace how it updates: add a subscription so external changes from the top-nav picker update it. Replace the `setAudioOutputDeviceId` callback (lines 147-150) and add a subscription effect:

```tsx
  // Reflect global output-device changes (picker now lives in the top nav).
  useEffect(() => {
    return subscribeToAudioSinkChanges((next) => setAudioOutputDeviceIdState(next));
  }, []);
```

Delete the now-unused `setAudioOutputDeviceId` `useCallback` and the `setAudioSinkPreference` import if nothing else references them (tsc in Step 4 will confirm). The `getAudioSinkPreference` initializer for the state stays.

- [ ] **Step 4: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "AudioOutputPicker|TopNav|BottomPlayer" || echo "no type errors"`
Expected: `no type errors`. Remove any unused-import / unused-variable errors that surface (e.g. a leftover `setAudioSinkPreference` import in BottomPlayer).

- [ ] **Step 5: Manual verification (dev server)**

Run the app (or restart the container per the project's Docker flow) and open the app. Then:
- **Output:** open the top-nav Audio devices picker, choose Spark (or any non-default output). Confirm sound comes from the selected device for: the top-nav metronome, the standalone Metronome page, count-in before a track, a chord/note "play" (ChordBuilder / Circle of Fifths progression), Note Trainer reference tone, a local (non-YouTube) video, and playing back a recording.
- **Input:** choose an input device. Start a recording and confirm the level meter/audio reflects that input; confirm the Tuner and Note Trainer respond to it.
- **Fallback:** the YouTube iframe still plays through system default (expected). No crashes if a device is unplugged.

- [ ] **Step 6: Commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
git add src/components/AudioOutputPicker.tsx src/components/TopNav.tsx src/components/BottomPlayer.tsx
git commit -m "feat(audio): move device picker to top nav with input + output selection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** input preference layer + helpers (Task 1); output routing for singletons (Task 2), metronomes (Task 3), media elements (Task 4); global input capture across recorder/tuner/note-trainer (Task 5); combined top-nav picker + BottomPlayer picker removal + external-change sync (Task 6). YouTube left unrouted per non-goals. All spec sections covered.
- **Type consistency:** `routeContextToSink(ctx)`, `routeMediaElementToSink(el)`, `withInputDevice(base)`, `resolveInputDeviceId(pref)`, and the input pref get/set/subscribe names are defined in Task 1 and used verbatim in Tasks 2-6. The changed `useAudioRecorder` return shape (Task 5) is matched by consumer edits in the same task. The generalized `AudioOutputPicker` prop names (`outputDeviceId`/`onOutputChange`/`inputDeviceId`/`onInputChange`) are produced in Task 6 Step 1 and consumed in Step 2.
- **DRY:** Task 6 extracts `DeviceSection` rather than duplicating the option-button block for input vs output.
- **No test framework:** every task verifies via `npx tsc --noEmit`; the end-to-end behavior is covered by the Task 6 manual matrix (browser-only APIs cannot be exercised under Node).
- **Known minor:** `resolveInputDeviceId` returns `null` for the `"default"` sentinel so `withInputDevice` omits the constraint (system default mic) — intentional, since `deviceId: { exact: "default" }` is unreliable for input.
