/* eslint-disable @typescript-eslint/no-explicit-any --
 * Inspects alphaTab's runtime exports, including @internal ones that have no
 * published types. That is the point of this file.
 */
import { describe, it, expect } from "vitest";
import * as alphaTabModule from "@coderline/alphatab";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseTex } from "./parse";
import { BINDING_REACH_BARS } from "./commands/barEdit";

const alphaTab = alphaTabModule as any;
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const sha = (path: string) => createHash("sha256").update(readFileSync(ROOT + path)).digest("hex");

// The note preview (src/components/tabs/previewSynth.ts) drives alphaTab's own
// worker synth directly. These are the members it uses. An alphaTab upgrade
// that renames or drops one should fail here, not leave previews silent.
describe("alphaTab internals the note preview relies on", () => {
  it("still exports the synth and MIDI classes", () => {
    for (const cls of [
      alphaTab.synth.AlphaSynthWebWorkerApi,
      alphaTab.synth.AlphaSynthAudioWorkletOutput,
      alphaTab.synth.AlphaSynthScriptProcessorOutput,
      alphaTab.midi.MidiFile,
      alphaTab.midi.AlphaSynthMidiFileHandler,
      alphaTab.midi.MidiFileGenerator,
      alphaTab.Settings,
    ]) {
      expect(typeof cls).toBe("function");
    }
    expect(typeof alphaTab.model.SlideOutType.Legato).toBe("number");
  });

  it("still has the members the preview synth calls", () => {
    const proto = alphaTab.synth.AlphaSynthWebWorkerApi.prototype;
    for (const method of ["loadMidiFile", "loadSoundFont", "play", "stop", "destroy"]) {
      expect(typeof proto[method], method).toBe("function");
    }
    for (const setter of ["masterVolume", "playbackSpeed", "metronomeVolume", "countInVolume", "isLooping"]) {
      expect(typeof Object.getOwnPropertyDescriptor(proto, setter)?.set, setter).toBe("function");
    }
    expect(typeof alphaTab.midi.MidiFileGenerator.prototype.generateSingleBeat).toBe("function");
  });

  it("ships the same build in public/ as in node_modules", () => {
    // The page bundles node_modules; the worker and worklet load public/.
    for (const file of ["alphaTab.mjs", "alphaTab.core.mjs", "alphaTab.worker.mjs", "alphaTab.worklet.mjs"]) {
      expect(sha(`public/${file}`), file).toBe(sha(`node_modules/@coderline/alphatab/dist/${file}`));
    }
  });
});

// The tie and legato walks (commands/rest.ts, commands/tie.ts) look only as far
// as alphaTab binds: BINDING_REACH_BARS bars either side of the edit. An
// alphaTab that looked further would leave ties bound across a new rest.
describe("alphaTab's reach, which the tie and legato walks stop at", () => {
  const tieAt = (body: string, barIndex: number) =>
    parseTex(`\\tempo 120\n.\n${body}\n`).score.tracks[0].staves[0].bars[barIndex].voices[0].beats[0].notes[0];

  it("is Note._maxOffsetForSameLineSearch bars", () => {
    expect(alphaTab.model.Note._maxOffsetForSameLineSearch).toBe(BINDING_REACH_BARS);
  });

  it("binds a tie three bars after its origin, and leaves one four bars after it an open string", () => {
    const three = tieAt("3.6.4 r r r | r r r r | r r r r | -.6.4 r r r", 3);
    expect([three.isTieDestination, three.fret]).toEqual([true, 3]);
    const four = tieAt("3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r", 4);
    expect([four.isTieDestination, four.fret]).toEqual([false, 0]);
  });
});
