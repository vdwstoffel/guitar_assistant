/**
 * The AlphaTex a freshly created tab starts as.
 *
 * The rests deliberately carry NO duration suffix. In AlphaTex a beat without
 * one inherits the previous beat's duration, which is what makes note entry
 * feel sticky: pick a sixteenth once and every beat you fill afterwards is a
 * sixteenth, until you change it again.
 *
 * Writing `r.4 r.4 r.4 r.4` instead — as this template used to — pins every
 * beat to a quarter before the user has chosen anything, so changing one
 * beat's duration has no effect on the next and the editor appears to keep
 * resetting to a default.
 */
export function emptyTabTex(tempo: number): string {
  return `\\tempo ${tempo}\n.\nr r r r\n`;
}
