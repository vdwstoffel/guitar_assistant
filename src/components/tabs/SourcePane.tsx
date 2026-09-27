"use client";

import { useRef } from "react";
import type { TexDiagnostic } from "@/lib/tabscore/parse";
import { codepointToUtf16, normalizeNewlines } from "@/lib/tabscore/offsets";

export interface SourcePaneProps {
  tex: string;
  diagnostics: TexDiagnostic[];
  onChange: (tex: string) => void;
}

// Error/warning match the brief exactly. `hint` isn't called out there, but
// the type carries it, so it needs *some* treatment rather than falling
// through to an accidental default. Blue reads as "informational, not
// urgent" and stays clearly distinct from the red/amber pair and from the
// neutral grays used for the line:col label and the empty-state text — see
// the report for the full reasoning.
const SEVERITY_TEXT: Record<TexDiagnostic["severity"], string> = {
  error: "text-red-400",
  warning: "text-amber-400",
  hint: "text-sky-400",
};

const SEVERITY_LABEL: Record<TexDiagnostic["severity"], string> = {
  error: "Error",
  warning: "Warning",
  hint: "Hint",
};

export default function SourcePane({ tex, diagnostics, onChange }: SourcePaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Behaviour 3: move the textarea's selection to a diagnostic's position.
  // `offset` is a 0-based CODEPOINT offset (alphaTab AST convention);
  // `setSelectionRange` wants a UTF-16 index. Both index off of `tex` — not
  // `textareaRef.current.value` — since the prop is the authoritative
  // current text and matches what `diagnostics` was computed against.
  //
  // CRLF fix: `parseTex` normalises newlines before parsing (parse.ts:49),
  // so `d.offset` is a codepoint offset into the NORMALISED text, not the
  // raw `tex` prop. And per the HTML spec, a textarea's selection API
  // (`selectionStart`/`setSelectionRange`) always operates on the
  // newline-normalised "API value," not on whatever raw string was last
  // assigned to `.value` — the JS-level `tex` prop only becomes normalised
  // itself once the user has typed at least one character (because
  // `onChange` is fed `e.target.value`, which the browser already
  // normalises). Before that first keystroke — e.g. right after loading a
  // saved document with CRLF endings — `tex` can still carry raw `\r\n`,
  // which would misalign a codepoint count taken against it (each CRLF is
  // 2 codepoints raw vs. 1 normalised). Normalising the LOCAL copy used
  // here (not the rendered `value={tex}` itself, which stays untouched to
  // preserve caret behaviour) keeps this calculation in the same space as
  // both `d.offset` and the DOM's own selection indexing, in both the
  // pre-input and post-input cases (`normalizeNewlines` is idempotent, so
  // this is a no-op once `tex` is already LF-only).
  const selectDiagnostic = (d: TexDiagnostic) => {
    const el = textareaRef.current;
    if (!el) return;
    const index = codepointToUtf16(normalizeNewlines(tex), d.offset);
    el.focus();
    el.setSelectionRange(index, index);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <textarea
        ref={textareaRef}
        value={tex}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="Type AlphaTex here..."
        aria-label="AlphaTex source"
        className="flex-1 min-h-0 w-full resize-none bg-gray-600 text-gray-200 placeholder-gray-400 font-mono text-xs leading-relaxed p-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
      />

      <div
        className="mt-2 max-h-48 shrink-0 overflow-y-auto border-t border-gray-500 pt-2 space-y-1"
        aria-label="AlphaTex diagnostics"
      >
        {diagnostics.length === 0 ? (
          <p className="text-xs text-gray-500 italic px-1">No problems.</p>
        ) : (
          diagnostics.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectDiagnostic(d)}
              title={`Go to line ${d.line}, column ${d.col}`}
              className={`block w-full text-left text-xs px-1.5 py-1 rounded hover:bg-gray-700 focus:outline-none focus:bg-gray-700 ${SEVERITY_TEXT[d.severity]}`}
            >
              <span className="text-gray-400 mr-1.5 tabular-nums">
                {d.line}:{d.col}
              </span>
              <span className="sr-only">{SEVERITY_LABEL[d.severity]}: </span>
              {d.message}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
