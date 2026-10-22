# Improvement ideas — discussion doc

Created 2026-10-22 by the Hermes agent, at Jasper's request, for vdwstoffel to review.
Each item is a proposal with a verdict-ready summary — mark each **go / no-go / later**.
Nothing here is implemented yet. Current state: PR #1 open, both playback-sync issues
(scroll blocking, bar-click count-in) confirmed fixed by Jasper's testing.

---

## 1. Realistic sounds: sound-library picker (recommended first step)

**Problem:** playback currently uses the generic `sonivox.sf2` General-MIDI soundfont.
GM guitar patches are the weakest link — they sound like a keyboard imitating a guitar.

**Idea:** alphaTab natively supports loading additional soundfonts
(`api.loadSoundFont(url, append)`) and mapping tracks to channels. Bundle 3–5 curated,
free soundfonts and add a per-track "Sound" dropdown (persisted preference, same
pattern as the Mix toggle). Works fully in-browser, on every platform, no user install.

Candidate banks (all free; licenses to be double-checked before bundling):

| Instrument | Candidates |
|---|---|
| Guitar / bass | single-note guitar SF2s (sf2uitar.com, polyphone.io, zanderjaz archives) — real single-note samples beat GM patches by a wide margin |
| Drums | Besilent (CC0), GeneralUser GS |
| Piano / Rhodes | Besilent piano, GeneralUser GS; Orchestral Tools *Roads* is excellent but needs their player, so likely not SF2-compatible |

**Constraints / honesty:**
- Browser memory: FluidSynth runs in WASM. Banks up to tens of MB are fine;
  multi-GB sample libraries are out — this is a quality-per-MB decision.
- A better soundfont fixes *tone*, not *articulation* (see item 2). Expect
  "clearly more realistic", not photorealistic performance.

**Effort:** small. One afternoon per bank (bundle, wire picker, per-track mapping),
plus curation time to pick banks that actually sound good.

---

## 2. Notation-aware humanization (recommended second step)

**Problem:** alphaTab plays every note at grid time with notation-derived velocity.
Held chords fire as block chords; picked runs are mechanically even. That is the
"robot player" tell, more than tone quality.

**Key nuance:** off-the-shelf MIDI humanizers (random timing/velocity jitter on a
`.mid` file) are built for DAW piano-roll MIDI that carries *no* musical intent.
Our MIDI already carries semantics — accents `>`, dynamics, staccato, dead notes
`(x)`, ghost notes, palm mute all change emitted velocity. Blanket random jitter
would fight that intent. The right flavor here is **musical, targeted humanization**:

1. **Chord strum spread** — offset the note-on times of a chord (notes on different
   strings at the same beat) by 10–40 ms in strum order, optionally alternating
   down/up strums across consecutive chords. Biggest single "sounds like a human"
   lever for guitar. Tools like StepStrum do exactly this in DAWs.
2. **Pick-direction velocity** — slight alternation for alternate-picking runs
   (downstroke marginally louder). Deterministic and musical, not random.
3. **Optional "loosen playback" toggle** — classic bounded jitter (±15 ms timing,
   ±10 velocity, seeded so playback is reproducible), mainly useful for drum tracks
   and backing parts where grid-perfect really does sound cold.

**Technical unknown to spike first:** whether alphaTab exposes a hook in its
MIDI-generation path (`MidiFileGenerator` → internal sequencer) that lets us adjust
note timing/velocity *without desyncing the visual cursor*. Live playback uses the
internal sequencer, not an exported file; `api.generateMidiFile()` exists but
export→humanize→replay would break cursor sync unless engineered carefully.
If no hook exists, this item gets harder and item 1 carries more weight.

**Effort:** spike ~1 evening; implementation small if the hook exists, medium otherwise.

---

## 3. VST hosting via local companion (possible, but heavy — decide later)

**Idea:** keep alphaTab as notation/MIDI engine; stream live MIDI to a small native
helper process that hosts VST3 instruments and plays back the audio. A "studio mode".

**Reality check:**
- VST is a native DAW-plugin format — it **cannot load in a browser tab**. alphaTab's
  synth is FluidSynth compiled to WASM; no soundfont→VST bridge exists.
- The viable route: a companion app (per-user install) using Spotify's **pedalboard**
  Python library, which does support loading VST3 *instruments* on Linux/mac/Windows,
  plus `pedalboard-pluginary` to scan installed plugins for a selection UI.
- Hard problems: real-time MIDI→VST latency, audio/cursor sync, and plugin
  misbehaviour — pedalboard's own compatibility notes warn many free plugins don't
  conform outside a real DAW.
- The well-known free VSTs (Ample Guitar M Lite II, MT Power Drum Kit 2, Bass P Lite
  II, Piano One) would slot into this bridge — but only into the companion app, not
  the web app.

**My position:** do item 1 first; it delivers most of the perceived realism with zero
infrastructure. Revisit VST only if soundfont quality genuinely caps out and users
ask for DAW-grade tone. If approved, start with a latency/sync spike (pedalboard +
MIDI-over-WebSocket) before committing to a companion app.

---

## 4. Small open items carried over from the playback round

- **Loop-range discoverability** — drag-across-bars to loop works but is invisible
  until you know it exists. A hint chip or first-use tooltip would help. (deferred,
  low priority)
- **Fit-to-width revisit** — no sideways scrolling was seen at 1280×720; only worth
  revisiting if it shows up on a specific screen.

---

## Suggested decision order

| # | Item | My recommendation |
|---|---|---|
| 1 | Sound-library picker (SF2 banks) | **GO** — biggest perceived win, native to the architecture |
| 2 | Strum spread + pick velocity (after hook spike) | **GO if spike finds a hook** |
| 3 | VST companion app | **LATER** — spike only after 1 lands and demand is proven |
| 4 | Loop-hint chip | nice-to-have, whenever convenient |
