"use client";

interface TrackSourceSwitchProps {
  /** Which source is showing. */
  source: "audio" | "tab";
  onChange: (source: "audio" | "tab") => void;
  hasAudio: boolean;
  hasTab: boolean;
  /** Add whichever source this entry lacks. */
  onAddAudio: () => void;
  onAddTab: () => void;
  busy?: boolean;
}

const BTN =
  "px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * A song is one entry; the recording and the tab are two ways of hearing it.
 *
 * Only one plays at a time, which is what keeps this simple — there is no
 * sync between a synthesised score and a recording, because they never sound
 * together. When an entry has only one source, the switch becomes an offer
 * to add the other, so a pair that arrived as two separate imports can be
 * joined without re-importing either.
 */
export default function TrackSourceSwitch({
  source,
  onChange,
  hasAudio,
  hasTab,
  onAddAudio,
  onAddTab,
  busy,
}: TrackSourceSwitchProps) {
  const on = "bg-purple-700 border-purple-600 text-white";
  const off = "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white";

  return (
    <div className="flex items-center gap-1">
      {hasAudio && hasTab ? (
        <>
          <button
            type="button"
            onClick={() => onChange("audio")}
            aria-pressed={source === "audio"}
            className={`${BTN} ${source === "audio" ? on : off}`}
          >
            🎵 Audio
          </button>
          <button
            type="button"
            onClick={() => onChange("tab")}
            aria-pressed={source === "tab"}
            className={`${BTN} ${source === "tab" ? on : off}`}
          >
            🎼 Tab
          </button>
        </>
      ) : hasAudio ? (
        <button type="button" onClick={onAddTab} disabled={busy} className={`${BTN} ${off}`}>
          {busy ? "Adding…" : "🎼 Add tab"}
        </button>
      ) : (
        <button type="button" onClick={onAddAudio} disabled={busy} className={`${BTN} ${off}`}>
          {busy ? "Adding…" : "🎵 Add audio"}
        </button>
      )}
    </div>
  );
}
