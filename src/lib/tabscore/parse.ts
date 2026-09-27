/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import * as alphaTab from "@coderline/alphatab";
import { normalizeNewlines } from "./offsets";

export interface TexDiagnostic {
  severity: "error" | "warning" | "hint";
  message: string;
  line: number;
  col: number;
  offset: number;
}

export interface ParseResult {
  /** AlphaTexScoreNode — the CST carrying source offsets. */
  scoreNode: any | null;
  /** alphaTab Score — null when the document is invalid. */
  score: any | null;
  diagnostics: TexDiagnostic[];
  ok: boolean;
}

/** AlphaTexParseMode.Full — retains full syntax fidelity. */
const PARSE_MODE_FULL = 1;

/** AlphaTexDiagnosticsSeverity: Hint = 0, Warning = 1, Error = 2. */
const SEVERITY: Record<number, TexDiagnostic["severity"]> = {
  0: "hint",
  1: "warning",
  2: "error",
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Diagnostic bags expose `.items`; each item carries a `start` location. */
function collect(bag: any, out: TexDiagnostic[]): void {
  for (const d of bag?.items ?? []) {
    out.push({
      severity: SEVERITY[d.severity as number] ?? "hint",
      message: String(d.message ?? d.code ?? "alphaTex diagnostic"),
      line: d.start?.line ?? 1,
      col: d.start?.col ?? 1,
      offset: d.start?.offset ?? 0,
    });
  }
}

export function parseTex(text: string): ParseResult {
  text = normalizeNewlines(text);
  const { AlphaTexParser } = (alphaTab as any).importer.alphaTex;
  const { AlphaTexImporter } = (alphaTab as any).importer;
  const { Settings } = alphaTab as any;

  const diagnostics: TexDiagnostic[] = [];
  let scoreNode: any = null;

  // 1. Parse for the AST. This is the only thing that carries source offsets.
  try {
    const parser = new AlphaTexParser(text);
    parser.mode = PARSE_MODE_FULL;
    scoreNode = parser.read();
  } catch (e) {
    diagnostics.push({ severity: "error", message: messageOf(e), line: 1, col: 1, offset: 0 });
    return { scoreNode: null, score: null, diagnostics, ok: false };
  }

  // 2. Import for validation. The parser alone is lenient — it reads `(((`
  //    without complaint and reports nothing — so the importer is what
  //    actually decides whether a document is valid.
  const importer = new AlphaTexImporter();
  importer.logErrors = false;
  let score: any = null;
  try {
    importer.initFromString(text, new Settings());
    score = importer.readScore();
  } catch (e) {
    // AlphaTexErrorWithDiagnostics carries the bags; other errors do not.
    const source = (e as any)?.semanticDiagnostics ? (e as any) : importer;
    collect(source.lexerDiagnostics, diagnostics);
    collect(source.parserDiagnostics, diagnostics);
    collect(source.semanticDiagnostics, diagnostics);
    if (!diagnostics.some((d) => d.severity === "error")) {
      diagnostics.push({ severity: "error", message: messageOf(e), line: 1, col: 1, offset: 0 });
    }
    return { scoreNode, score: null, diagnostics, ok: false };
  }

  collect(importer.lexerDiagnostics, diagnostics);
  collect(importer.parserDiagnostics, diagnostics);
  collect(importer.semanticDiagnostics, diagnostics);

  return {
    scoreNode,
    score,
    diagnostics,
    ok: !diagnostics.some((d) => d.severity === "error"),
  };
}
