/* eslint-disable @typescript-eslint/no-explicit-any --
 * The tests read alphaTab's model, whose types are only reachable through
 * namespaces that cannot be imported as types.
 */
import { parseTex } from "../parse";

/**
 * For tests only: what the paste, range-edit and duplicate tests read back from
 * alphaTab's model of a text, to say a command changed nothing it should not.
 */

/** One beat as alphaTab reads it: its length (duration, dots, tuplet, grace) and its pitches. */
export interface ModelBeat {
  length: string;
  pitch: string;
}

/** alphaTab's beats, bar by bar: the first track's, staff's and voice's. */
export const model = (text: string): any[][] =>
  parseTex(text).score.tracks[0].staves[0].bars.map((bar: any) => bar.voices[0].beats);

/** Every beat's length and pitches, bar by bar. */
export const read = (text: string): ModelBeat[][] =>
  model(text).map((beats) =>
    beats.map((b: any) => ({
      length: `${b.duration}/${b.dots}/${b.tupletNumerator}/${b.graceType}`,
      pitch: b.notes.map((n: any) => n.realValue).sort().join(","),
    })),
  );

/**
 * What alphaTab binds each note to — a hammer-on's or slide's target, a tie's
 * origin — keyed by the note's beat and string and the kind (`h`, `s`, `t`),
 * as `bar:beat/string/kind`, each to `bar:beat`.
 */
export const bindings = (text: string): Map<string, string> => {
  const at = (beat: any) => `${beat.voice.bar.index}:${beat.index}`;
  const out = new Map<string, string>();
  for (const beats of model(text)) {
    for (const beat of beats) {
      for (const n of beat.notes) {
        const key = `${at(beat)}/${n.string}`;
        if (n.isHammerPullOrigin && n.hammerPullDestination) out.set(`${key}/h`, at(n.hammerPullDestination.beat));
        if (n.slideTarget) out.set(`${key}/s`, at(n.slideTarget.beat));
        if (n.isTieDestination && n.tieOrigin) out.set(`${key}/t`, at(n.tieOrigin.beat));
      }
    }
  }
  return out;
};
