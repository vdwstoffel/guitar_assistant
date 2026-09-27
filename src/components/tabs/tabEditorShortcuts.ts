import type { ShortcutGroup } from "@/components/KeyboardShortcutsHelp";

/**
 * What the tab editor's keyboard does, for the `?` help panel.
 *
 * This list is written by hand rather than derived from `matchChord`, because
 * the keymap knows which chord maps to which command but nothing about how to
 * describe it to a person. The risk is drift — a binding changes and this text
 * quietly lies. `tabEditorShortcuts.test.ts` guards against exactly that by
 * asserting every key named here still resolves to a command.
 */
export const TAB_EDITOR_SHORTCUTS: ShortcutGroup[] = [
  {
    group: "Playback",
    items: [
      { keys: ["Space"], description: "Play / Pause (or use the toolbar)" },
      {
        keys: ["Drag"],
        description: "Drag across the score to pick a section to practise (whole bars)",
        mouse: true,
      },
    ],
  },
  {
    group: "Notes",
    items: [
      { keys: ["0"], description: "Type a fret number; two digits compose (1 then 2 = 12)" },
      { keys: ["Delete"], description: "Clear the note at the caret" },
      { keys: ["Backspace"], description: "Clear the note at the caret" },
    ],
  },
  {
    group: "Note value",
    items: [
      { keys: ["+"], description: "Longer note (8th becomes quarter)" },
      { keys: ["-"], description: "Shorter note (8th becomes 16th)" },
      { keys: ["]"], description: "Longer note" },
      { keys: ["["], description: "Shorter note" },
      { keys: ["."], description: "Toggle dotted" },
      {
        keys: ["u"],
        description: "Triplet — makes this beat and the next two one group; again to undo",
      },
    ],
  },
  {
    group: "Moving around",
    items: [
      { keys: ["←"], description: "Previous beat" },
      { keys: ["→"], description: "Next beat — adds one at the end of the tab" },
      { keys: ["↑"], description: "String up (toward high e)" },
      { keys: ["↓"], description: "String down (toward low E)" },
    ],
  },
  {
    group: "Bars & beats",
    items: [
      { keys: ["Insert"], description: "Insert a beat after the caret (or the + Beat button)" },
      { keys: ["Shift", "Delete"], description: "Delete the beat at the caret" },
      { keys: ["Ctrl", "Enter"], description: "Add a bar at the end (or the + Bar button)" },
      { keys: ["Ctrl", "Shift", "Backspace"], description: "Delete the bar at the caret" },
      {
        keys: ["Toolbar"],
        description:
          "𝄆 Repeat start / 𝄇 Repeat end — mark the caret's bar; nothing in between needs selecting",
        mouse: true,
      },
    ],
  },
  {
    group: "Techniques",
    items: [
      { keys: ["h"], description: "Hammer-on / pull-off" },
      { keys: ["s"], description: "Slide" },
      { keys: ["p"], description: "Palm mute" },
      { keys: ["v"], description: "Vibrato" },
      { keys: ["x"], description: "Dead note" },
      { keys: ["g"], description: "Ghost note" },
      { keys: ["t"], description: "Tap" },
      { keys: ["n"], description: "Harmonic" },
      { keys: ["l"], description: "Let ring" },
      { keys: ["b"], description: "Bend" },
      { keys: ["i"], description: "Tie to the previous note on this string" },
    ],
  },
  {
    group: "Other",
    items: [
      { keys: ["Ctrl", "Z"], description: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
      { keys: ["?"], description: "Show this help" },
    ],
  },
];
