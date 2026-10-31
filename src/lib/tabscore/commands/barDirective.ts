/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { sliceCp, spliceCp } from "../offsets";

interface BarDirective {
  /** Inclusive codepoint bounds of the whole directive, trailing whitespace included. */
  cpStart: number;
  cpEnd: number;
  /** Inclusive end of the directive itself, before that whitespace. */
  textEnd: number;
}

/**
 * The directive `name` (`ts` for `\ts`) written on one bar, if there is one.
 * Bar 0's metadata also holds the header — `\tempo`, `\tuning`, and anything
 * else written before the `.` — so a header `\ts` is found here too and can be
 * edited where it is.
 */
function findBarDirective(text: string, scoreNode: any, barIndex: number, name: string): BarDirective | null {
  const metaData: any[] = scoreNode?.bars?.[barIndex]?.metaData ?? [];
  for (const node of metaData) {
    if (!node?.tag?.start || !node?.start || !node?.end) continue;
    const tag = sliceCp(text, node.tag.start.offset, node.tag.end.offset);
    if (!new RegExp(`\\\\\\s*${name}\\b`).test(tag)) continue;

    // A node's end, like `\tempo`'s argument's, is inclusive and runs on
    // through the following whitespace. A rewrite stops short of it so a
    // header directive keeps its newline; a removal takes it along.
    let textEnd = node.end.offset;
    while (textEnd > node.start.offset && /\s/.test(sliceCp(text, textEnd, textEnd))) textEnd--;
    return { cpStart: node.start.offset, cpEnd: node.end.offset, textEnd };
  }
  return null;
}

/**
 * The text with bar `barIndex`'s `name` directive rewritten to `directive`,
 * written in when the bar has none, or taken off when `directive` is null.
 *
 * A new one goes before the bar's first beat, for the reason repeat.ts gives:
 * written after the previous bar's last beat, alphaTab parses it as an extra,
 * empty bar. Null when there is nothing to take off, or no beat to write it
 * in front of.
 */
export function writeBarDirective(
  text: string,
  scoreNode: any,
  barIndex: number,
  name: string,
  directive: string | null,
): string | null {
  const existing = findBarDirective(text, scoreNode, barIndex, name);
  if (directive === null) return existing ? spliceCp(text, existing.cpStart, existing.cpEnd, "") : null;
  if (existing) return spliceCp(text, existing.cpStart, existing.textEnd, directive);

  const at = scoreNode?.bars?.[barIndex]?.beats?.[0]?.start?.offset;
  return typeof at === "number" ? spliceCp(text, at, at - 1, `${directive} `) : null;
}
