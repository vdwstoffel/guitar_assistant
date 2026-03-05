import { ComponentType } from "react";
import WritingAMetalSong from "./WritingAMetalSong";

export interface TheoryNote {
  slug: string;
  title: string;
  category: string;
  component: ComponentType;
}

const notes: TheoryNote[] = [
  {
    slug: "writing-a-metal-song",
    title: "Writing a Metal Song",
    category: "Songwriting",
    component: WritingAMetalSong,
  },
];

export default notes;
