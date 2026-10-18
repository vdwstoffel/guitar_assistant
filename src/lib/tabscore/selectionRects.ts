/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's model and bounds types are only reachable through namespaces
 * that cannot be imported as types across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { beatAt } from "./caretBeat";
import type { Range } from "./selection";

/** A rectangle in the score surface's own coordinates (alphaTab's bounds lookup). */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where to draw a selection over a rendered score: one rectangle per system
 * row it crosses — alphaTab's own recipe for its playback-range highlight.
 * It runs from the first beat's left edge to the last beat's right edge
 * (beat `realBounds`, which tile their bar), stretched to the bar's edge when
 * that beat is its bar's first or last; a row in between is the whole row.
 * Empty when either end is not on the rendered score.
 *
 * Null when the lookup is not this score's yet. alphaTab's api takes a new
 * Score the moment a render starts, but keeps the last render's bounds until
 * that render's postRenderFinished; and beat ids restart with every parse, so
 * that lookup finds the new Score's beats by id — where the old render drew
 * other beats. The beat each bounds entry was made for tells the two apart.
 */
export function selectionRects(score: any, lookup: any, range: Range): Rect[] | null {
  const first = beatAt(score, { ...range.from, string: 1 });
  const last = beatAt(score, { ...range.to, string: 1 });
  const start = first && lookup?.findBeat(first);
  const end = last && lookup?.findBeat(last);
  if (!start || !end) return [];
  if (start.beat !== first || end.beat !== last) return null;
  const startBar = start.barBounds.masterBarBounds;
  const endBar = end.barBounds.masterBarBounds;
  const left = first.index === 0 ? startBar.realBounds.x : start.realBounds.x;
  const right =
    last.index === last.voice.beats.length - 1
      ? endBar.realBounds.x + endBar.realBounds.w
      : end.realBounds.x + end.realBounds.w;
  const rect = (x0: number, x1: number, row: any): Rect => ({ left: x0, top: row.y, width: x1 - x0, height: row.h });
  const startSystem = startBar.staffSystemBounds;
  const endSystem = endBar.staffSystemBounds;
  if (startSystem === endSystem) return [rect(left, right, startBar.visualBounds)];
  const rightEdge = (system: any) => system.visualBounds.x + system.visualBounds.w;
  const rows = [rect(left, rightEdge(startSystem), startBar.visualBounds)];
  for (let i = startSystem.index + 1; i < endSystem.index; i++) {
    const system = lookup.staffSystems[i];
    rows.push(rect(system.visualBounds.x, rightEdge(system), system.visualBounds));
  }
  rows.push(rect(endSystem.visualBounds.x, right, endBar.visualBounds));
  return rows;
}
