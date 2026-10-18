import type { ShortcutGroup } from "@/components/KeyboardShortcutsHelp";

/**
 * What the tab editor's keyboard does, for the `?` help panel.
 *
 * This list is written by hand rather than derived from `matchChord`, because
 * the keymap knows which chord maps to which command but nothing about how to
 * describe it to a person. The risk is drift — a binding changes and this text
 * quietly lies. `tabEditorShortcuts.test.ts` guards against exactly that by
 * asserting every key named here still resolves to a command — except the
 * clipboard entries (`clipboard: true`: Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+Shift+V), which
 * resolve to nothing on purpose: the browser turns their keydowns into the
 * copy, cut and paste events the editor handles, and a claimed keydown never
 * becomes one. The test checks that they do resolve to nothing. Mouse entries
 * (`mouse: true`) are not keys and are not checked.
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
      {
        keys: ["Toolbar"],
        description: "♪ Notes — hear each beat as you enter it or move onto it",
        mouse: true,
      },
    ],
  },
  {
    group: "Notes",
    items: [
      { keys: ["0"], description: "Type a fret number; two digits compose (1 then 2 = 12)" },
      { keys: ["Delete"], description: "Clear the note at the caret — or make every selected beat a rest" },
      { keys: ["Backspace"], description: "Clear the note at the caret — or make every selected beat a rest" },
      { keys: ["r"], description: "Make the beat at the caret a rest (Ctrl+Z brings the notes back)" },
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
      {
        keys: ["→"],
        description: "Next beat — at the end of the tab it adds a beat, or a new bar when this one is full",
      },
      { keys: ["↑"], description: "String up (toward high e)" },
      { keys: ["↓"], description: "String down (toward low E)" },
    ],
  },
  {
    group: "Selecting, copying, pasting",
    items: [
      { keys: ["Shift", "→"], description: "Select beat by beat (Shift+← goes back)" },
      {
        keys: ["Ctrl", "Shift", "→"],
        description: "Select to the end of the bar, then bar by bar (Ctrl+Shift+← goes back)",
      },
      { keys: ["Shift", "Click"], description: "Select from the caret to the beat you click", mouse: true },
      { keys: ["Ctrl", "A"], description: "Select the whole tab" },
      { keys: ["Esc"], description: "Close the note menu if it is open, otherwise clear the selection" },
      { keys: ["Ctrl", "C"], description: "Copy the selection, or the beat at the caret", clipboard: true },
      { keys: ["Ctrl", "X"], description: "Cut: copy, then leave rests of the same length", clipboard: true },
      {
        keys: ["Ctrl", "V"],
        description: "Paste over the music from the caret; the bar keeps its length",
        clipboard: true,
      },
      {
        keys: ["Ctrl", "Shift", "V"],
        description: "Paste in front: bars before the caret's bar, beats before its beat",
        clipboard: true,
      },
      { keys: ["d"], description: "Duplicate the selection, or the caret's bar, right after itself" },
    ],
  },
  {
    group: "Bars & beats",
    items: [
      { keys: ["Insert"], description: "Insert a beat after the caret (or the + Beat button)" },
      {
        keys: ["Shift", "Delete"],
        description: "Delete the beat at the caret — or the selected beats; selected whole bars go as bars",
      },
      { keys: ["Ctrl", "Enter"], description: "Add a bar at the end (or the + Bar button)" },
      { keys: ["Ctrl", "Shift", "Backspace"], description: "Delete the bar at the caret" },
      {
        keys: ["Shift", "B"],
        description: "Fix the bar at the caret: fill a short bar with rests, trim a long one from the end",
      },
      {
        keys: ["Fix all"],
        description: "In the strip under the score when bars don't add up: fixes every one, one Ctrl+Z",
        mouse: true,
      },
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
    group: "Note menu",
    items: [
      { keys: ["Enter"], description: "Open the note menu at the caret: every command for the note, with its key" },
      { keys: ["Shift", "F10"], description: "Open the note menu (so does the keyboard's Menu key)" },
      {
        keys: ["Right-click"],
        description: "Open the note menu on a beat — inside the selection, the selection's own menu",
        mouse: true,
      },
      { keys: ["Click"], description: "Click the caret's note again to open the note menu; once more to close it", mouse: true },
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
