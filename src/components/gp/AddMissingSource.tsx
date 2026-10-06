"use client";

interface AddMissingSourceProps {
  hasAudio: boolean;
  hasTab: boolean;
  /** Add whichever source this song lacks. */
  onAddAudio: () => void;
  onAddTab: () => void;
  busy?: boolean;
}

const BTN =
  "px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white";

/**
 * The offer to complete a song: the recording for a tab that has none, or the
 * tab for a recording that has none.
 *
 * Replaced TrackSourceSwitch, which also chose which of the two you were
 * looking at. There is nothing to choose any more — a song with both shows the
 * score beside the recording and plays whichever you click into — so all that
 * is left is the invitation to add the missing half, and a song that has both
 * shows nothing at all.
 */
export default function AddMissingSource({
  hasAudio,
  hasTab,
  onAddAudio,
  onAddTab,
  busy,
}: AddMissingSourceProps) {
  if (hasAudio && hasTab) return null;

  return (
    <div className="flex items-center gap-1">
      {hasAudio ? (
        <button type="button" onClick={onAddTab} disabled={busy} className={BTN}>
          {busy ? "Adding…" : "🎼 Add tab"}
        </button>
      ) : (
        <button type="button" onClick={onAddAudio} disabled={busy} className={BTN}>
          {busy ? "Adding…" : "🎵 Add audio"}
        </button>
      )}
    </div>
  );
}
