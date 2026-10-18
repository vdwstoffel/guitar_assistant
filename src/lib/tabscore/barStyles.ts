/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's model types are only reachable through namespaces that cannot be
 * imported as types across the bundle boundary. These `any`s are the interop
 * boundary with that untyped surface, not unexamined typing.
 */
import { brokenBars, overflowBeats } from "./barFill";

/** A bar too long, and the beats that do not fit in it. */
export const LONG_COLOR = "#DC2626";
/** A bar too short. */
export const SHORT_COLOR = "#D97706";

/** Each member of an alphaTab sub-element enum, as [value, name]. */
const members = (enumObject: Record<string, string | number>): Array<[number, string]> =>
  Object.entries(enumObject)
    .filter(([, value]) => typeof value === "number")
    .map(([name, value]) => [value as number, name]);

/** The bar's own lines and number, on whichever staff draws them. */
const MARKED = /(StaffLine|BarLines|BarNumber)$/;

/**
 * Colour the broken bars of a freshly parsed Score in place, before
 * renderScore: a long bar's staff lines, bar lines and bar number red, and the
 * frets and rests of its beats that end past the bar line red too; a short
 * bar's lines and number amber. Exact and exempt bars are left alone.
 *
 * Every sub-element of a styled bar, beat or note gets an explicit colour,
 * the defaults copied from `resources` (api.settings.display.resources): for
 * a sub-element missing from a style's map alphaTab keeps whatever colour the
 * canvas last had (ElementStyleScope), so a partial map leaks red onto the
 * next thing drawn. Never null: the render worker's serializer cannot read it
 * back. Styles change colour only — the layout does not move.
 */
export function styleBrokenBars(alphaTab: any, score: any, resources: any): void {
  const { BarStyle, BarSubElement, BeatStyle, BeatSubElement, NoteStyle, NoteSubElement, Color } = alphaTab.model;
  const long = Color.fromJson(LONG_COLOR);
  const short = Color.fromJson(SHORT_COLOR);

  for (const { barIndex, state } of brokenBars(score)) {
    const colour = state.kind === "long" ? long : short;
    const bar = score.tracks[0].staves[0].bars[barIndex];
    const barStyle = new BarStyle();
    for (const [value, name] of members(BarSubElement)) {
      // The rest of a bar — clef, key and time signature, repeat signs — is
      // drawn in mainGlyphColor by default (ElementStyleHelper.bar,
      // alphaTab.core.mjs:59437); only the lines and number, MARKED here, have
      // defaults of their own, and those take the bar's colour.
      barStyle.colors.set(value, MARKED.test(name) ? colour : resources.mainGlyphColor);
    }
    bar.style = barStyle;
    if (state.kind !== "long") continue;

    for (const index of overflowBeats(score, barIndex)) {
      const beat = bar.voices[0].beats[index];
      const beatStyle = new BeatStyle();
      for (const [value, name] of members(BeatSubElement)) {
        beatStyle.colors.set(value, /Rests$/.test(name) ? long : resources.mainGlyphColor);
      }
      beat.style = beatStyle;
      for (const note of beat.notes) {
        const noteStyle = new NoteStyle();
        for (const [value, name] of members(NoteSubElement)) {
          noteStyle.colors.set(value, name === "GuitarTabFretNumber" ? long : resources.mainGlyphColor);
        }
        note.style = noteStyle;
      }
    }
  }
}
