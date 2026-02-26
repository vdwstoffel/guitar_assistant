import { ComponentType } from "react";
import TransposingMinorProgressions from "./TransposingMinorProgressions";
import BuildingChordsInMinorKey from "./BuildingChordsInMinorKey";

export interface TheoryNote {
  slug: string;
  title: string;
  category: string;
  component: ComponentType;
}

const notes: TheoryNote[] = [
  {
    slug: "building-chords-in-minor-key",
    title: "Building Chords in a Minor Key",
    category: "Harmony",
    component: BuildingChordsInMinorKey,
  },
  {
    slug: "transposing-minor-progressions",
    title: "Transposing Minor Progressions and Riffs",
    category: "Progressions",
    component: TransposingMinorProgressions,
  },
];

export default notes;
