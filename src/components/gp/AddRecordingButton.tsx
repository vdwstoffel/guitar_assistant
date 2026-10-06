"use client";

interface AddRecordingButtonProps {
  onClick: () => void;
  busy?: boolean;
}

/**
 * The offer to give a tab-only song its recording.
 *
 * Only this direction: a song with a recording but no tab is offered the
 * import where the score itself would be, which is both more discoverable
 * and the place you are already looking.
 */
export default function AddRecordingButton({ onClick, busy }: AddRecordingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white"
    >
      {busy ? "Adding…" : "🎵 Add audio"}
    </button>
  );
}
