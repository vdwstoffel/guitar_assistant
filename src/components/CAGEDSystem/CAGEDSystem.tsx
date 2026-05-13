"use client";

import { useMemo, useState } from "react";
import { NOTES } from "@/lib/musicTheory";
import CagedFretboard from "./CagedFretboard";
import {
  CAGED_SHAPES,
  transposeShape,
  transposeAllShapes,
  type CagedShapeName,
} from "./cagedShapes";

type Selection = "all" | CagedShapeName;
type ScaleChoice = "None" | "Major" | "Minor" | "Major Pentatonic" | "Minor Pentatonic";

const SHAPES: CagedShapeName[] = ["C", "A", "G", "E", "D"];
const SCALES: { id: ScaleChoice; label: string }[] = [
  { id: "None", label: "None" },
  { id: "Major", label: "Major" },
  { id: "Minor", label: "Minor" },
  { id: "Major Pentatonic", label: "Maj Pent" },
  { id: "Minor Pentatonic", label: "Min Pent" },
];

export default function CAGEDSystem() {
  const [rootNote, setRootNote] = useState<string>("C");
  const [selection, setSelection] = useState<Selection>("all");
  const [scale, setScale] = useState<ScaleChoice>("None");

  const allShapes = useMemo(() => transposeAllShapes(rootNote), [rootNote]);
  const shapesToRender = useMemo(() => {
    if (selection === "all") return allShapes;
    const shape = CAGED_SHAPES.find((s) => s.name === selection)!;
    return [transposeShape(shape, rootNote)];
  }, [selection, rootNote, allShapes]);

  const focusedShape = selection !== "all" ? shapesToRender[0] : null;

  return (
    <div
      className="flex-1 flex flex-col overflow-auto"
      style={{
        background: "linear-gradient(to bottom, hsl(23, 64%, 5%), hsl(23, 64%, 18%))",
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-100 mb-2">
            CAGED System
          </h1>
          <p className="text-amber-200/60 text-sm max-w-2xl mx-auto">
            Five movable shapes — C, A, G, E, D — that map any major chord
            across the entire fretboard. Pick a key and a shape to explore.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4 bg-neutral-900/60 border border-neutral-800 rounded-lg p-4">
          <ControlRow label="Key">
            {NOTES.map((k) => (
              <PillButton
                key={k}
                active={rootNote === k}
                onClick={() => setRootNote(k)}
              >
                {k}
              </PillButton>
            ))}
          </ControlRow>

          <ControlRow label="Shape">
            <PillButton
              active={selection === "all"}
              onClick={() => setSelection("all")}
            >
              All
            </PillButton>
            {SHAPES.map((s) => (
              <PillButton
                key={s}
                active={selection === s}
                onClick={() => setSelection(s)}
              >
                {s}
              </PillButton>
            ))}
          </ControlRow>

          <ControlRow label="Scale">
            {SCALES.map((s) => (
              <PillButton
                key={s.id}
                active={scale === s.id}
                onClick={() => setScale(s.id)}
              >
                {s.label}
              </PillButton>
            ))}
          </ControlRow>
        </div>

        {/* Fretboard */}
        <CagedFretboard
          rootNote={rootNote}
          shapes={shapesToRender}
          scaleType={scale === "None" ? undefined : scale}
        />

        {/* Footer info */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="text-amber-200/70">
            {focusedShape ? (
              <>
                <span className="text-amber-100 font-bold">{focusedShape.shape.name} shape</span>{" "}
                of <span className="text-amber-100 font-bold">{rootNote} major</span>{" "}
                — root at fret {focusedShape.rootFret}
              </>
            ) : (
              <>
                All five shapes of{" "}
                <span className="text-amber-100 font-bold">{rootNote} major</span>{" "}
                tiled up the neck. Pick a single shape to focus on it.
              </>
            )}
          </div>
          <Legend multi={!focusedShape} />
        </div>
      </div>
    </div>
  );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-amber-200/80 text-sm font-medium w-12 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-mono transition-colors ${
        active
          ? "bg-amber-500 text-neutral-900 font-bold"
          : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ multi }: { multi: boolean }) {
  if (multi) {
    return (
      <div className="flex items-center gap-3 text-amber-200/60 text-xs">
        <span>Each color = one shape.</span>
        <span>White-bordered dots = root notes.</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-amber-200/60 text-xs">
      <LegendDot color="#f59e0b" /> Root
      <LegendDot color="#0891b2" /> Chord tone
      <LegendDot color="transparent" ring="#f59e0b" /> Other roots on neck
    </div>
  );
}

function LegendDot({ color, ring }: { color: string; ring?: string }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full"
      style={{
        background: color,
        border: ring ? `1.5px solid ${ring}` : undefined,
      }}
    />
  );
}
