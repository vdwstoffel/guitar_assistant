# Global Audio Input/Output Device Selection — Design

**Date:** 2026-07-22
**Status:** Approved for planning

## Problem

The app has an audio **output** device picker ([AudioOutputPicker.tsx](../../../src/components/AudioOutputPicker.tsx)),
backed by [audioSink.ts](../../../src/lib/audioSink.ts) (a `localStorage` preference broadcast via a
custom event). But only **BottomPlayer** (song playback) and the **AlphaTab** tab players actually
subscribe and apply it. Every other sound source — both metronomes, count-in clicks, the
note/chord/interval generator, Circle-of-Fifths progressions, note-trainer reference tones, local
`<video>`, and recording playback — ignores the selection and plays through the system default.

Separately, microphone **input** has no global selection: [useAudioRecorder.ts](../../../src/hooks/useAudioRecorder.ts)
has its own local, non-persisted input picker, while the Tuner and Note Trainer just capture the
default mic.

Goal: one global, persisted selection each for **output** and **input** device, applied across the
entire app (e.g. route everything to/from a Positive Grid "Spark").

## Goals

- A single global output device preference applied to every routable sound source.
- A single global input device preference applied to **all** mic capture (recording, Tuner, Note Trainer).
- The picker lives in the **top nav** as a combined "Audio Settings" control (Output + Input), reachable app-wide.
- Reuse the existing `audioSink.ts` preference/broadcast pattern; no new state library.

## Non-Goals (YAGNI)

- No routing of the embedded **YouTube iframe** player (browsers don't expose output-device control
  to cross-origin iframes). It stays on system default, no warning UI.
- No hot-swap of an already-open mic stream; an input change takes effect on the next start/restart.
- No per-recording input override (the recorder defers to the global input selection).
- No React Context provider; the `audioSink.ts` module-level pub/sub is already effectively global.

## Design

### 1. Preference layer — extend `src/lib/audioSink.ts` with an input side

The output side is unchanged. Add a parallel **input** preference mirroring the output API:

- `localStorage` key `"audioInputDeviceId"` (output uses `"audioOutputDeviceId"`).
- `getAudioInputPreference(): string` — returns stored id or the auto-Spark sentinel.
- `setAudioInputPreference(pref: string): void` — persists and dispatches a change event.
- `subscribeToAudioInputChanges(cb: () => void): () => void` — subscription.
- `resolveInputDeviceId(pref: string): string | null` — resolves the preference to a concrete
  `deviceId` (auto-detect Spark by the existing `/spark\s*2/i` label regex against `audioinput`
  devices); returns `null` when the resolution is "system default / no constraint" so callers omit
  the `deviceId` constraint.

Keep the existing auto-Spark sentinel approach. The input change event may be a distinct event name
(e.g. `guitarAssistant:audioInputChanged`) or a shared event; the plan will pick one — the public
functions above are what callers use.

### 2. Output routing — apply the sink to every routable source

Add a shared helper in `audioSink.ts` that routes a Web Audio context to the selected output and is
safe when unsupported:

```
async function routeContextToSink(ctx: AudioContext): Promise<void>
// applies (ctx as any).setSinkId?.(resolveDeviceId(getAudioSinkPreference())) inside try/catch
```

Wire it into each source, each subscribing to output changes and re-applying:

- `src/lib/clickGenerator.ts` — route its singleton context on creation + subscribe. Fixes count-in
  clicks everywhere they are used.
- `src/lib/audioGenerator.ts` — route its singleton context on creation + subscribe. Fixes note,
  interval, and chord playback, Circle-of-Fifths progressions, and note-trainer reference tones (all
  funnel through this module).
- `src/components/Metronome.tsx` and the metronome in `src/components/TopNav.tsx` — route the context
  on start + subscribe.
- Local `<video>` in `src/components/VideoPlayer.tsx` and `src/components/Videos.tsx` — call
  `videoEl.setSinkId(resolveDeviceId(...))` on mount/when preference changes.
- `src/components/RecordingWaveform.tsx` — apply the sink to its WaveSurfer media element / context,
  same pattern as BottomPlayer.

BottomPlayer and the AlphaTab players are already correct and keep working unchanged (aside from the
picker moving out of BottomPlayer — see §4).

### 3. Input routing — apply the selected mic to every getUserMedia call

Add a shared helper in `audioSink.ts` that merges the global input device into a mic constraint:

```
function withInputDevice(base: MediaTrackConstraints = {}): MediaTrackConstraints
// returns { ...base, deviceId: { exact: id } } when resolveInputDeviceId(...) is non-null,
// otherwise returns base unchanged (system default)
```

Wire it into each capture site:

- `src/hooks/useAudioRecorder.ts` — build the recording constraints via `withInputDevice(...)`;
  **remove** the hook's local device-enumeration/picker state (`devices`, `selectedDeviceId`,
  `refreshDevices` device list, and the setter) in favor of the global preference. Keep permission
  handling. Subscribe so a global change is reflected on the next `start()`.
- `src/components/NoteTrainer/useNoteTrainer.ts` — pass `withInputDevice(...)` to its `getUserMedia`.
- `src/components/Tuner.tsx` — pass `withInputDevice(...)` to its `getUserMedia`.

An input change while a stream is live does **not** hot-swap; it applies on the next start/restart.

### 4. Combined picker in the top nav

`AudioOutputPicker` becomes a combined **Audio Settings** control rendered in `src/components/TopNav.tsx`
(a dropdown/popover) with two selectors:

- **Output** — device list + "Auto → Spark" + "System default" (existing behavior, moved).
- **Input** — device list (filtered to `audioinput`) + "Auto → Spark" + "System default".

Each writes through the matching `setAudio*Preference`. The control is removed from `BottomPlayer.tsx`
(BottomPlayer still subscribes/applies output — it just no longer hosts the UI). The component may be
renamed (e.g. `AudioDevicePicker`) or kept as-is with an added input section; the plan decides.

### 5. Error handling

- **Secure context:** all device APIs need HTTPS or `localhost`. Reuse the existing
  "secure (HTTPS) origin is required" messaging. Fine on `localhost` and the Caddy HTTPS setup.
- **`setSinkId` unsupported** (non-Chromium): catch and fall back to system default silently; the
  picker shows a subtle "output selection not supported in this browser" note.
- **Selected output device removed:** `resolveDeviceId` already falls back to `"default"`.
- **Selected input device removed:** `resolveInputDeviceId` returns `null` → `withInputDevice` omits
  the `deviceId` constraint → system default mic.
- **`getUserMedia` with `deviceId: { exact }` failing** (device gone mid-session): surface the
  existing mic-error messaging; the user can pick another device.
- **YouTube iframe:** documented limitation, stays on system default, no warning UI.

### 6. Testing

No unit-test framework in this project. Verification:

- `npx tsc --noEmit` (filtered to touched files) for type safety.
- Manual output check: select Spark as output, confirm sound emerges from Spark for — metronome
  (both), count-in, note/chord/interval playback, Circle-of-Fifths progression, note-trainer tones,
  local video, and recording playback.
- Manual input check: select an input device, confirm recording captures from it, and the Tuner and
  Note Trainer respond to that input.
- Fallback check: with a non-Chromium browser or after unplugging the selected device, confirm
  graceful fallback to system default with no crash.

## Files touched

- `src/lib/audioSink.ts` — add input preference API + `routeContextToSink` + `withInputDevice`.
- `src/lib/clickGenerator.ts`, `src/lib/audioGenerator.ts` — route singleton contexts + subscribe.
- `src/components/Metronome.tsx`, `src/components/TopNav.tsx` — route metronome contexts; host the picker.
- `src/components/VideoPlayer.tsx`, `src/components/Videos.tsx` — `setSinkId` on local video.
- `src/components/RecordingWaveform.tsx` — apply output sink.
- `src/hooks/useAudioRecorder.ts` — consume global input; remove local picker.
- `src/components/NoteTrainer/useNoteTrainer.ts`, `src/components/Tuner.tsx` — use global input.
- `src/components/AudioOutputPicker.tsx` — combined output+input picker (possibly renamed).
- `src/components/BottomPlayer.tsx` — remove the in-player picker.
