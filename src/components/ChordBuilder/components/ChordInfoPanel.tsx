import type { ChordToneInfo, KeyAppearance } from '../hooks/useChordBuilder';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChordInfoPanelProps {
  chordSymbol: string;
  chordTones: ChordToneInfo[];
  keyAppearances: KeyAppearance[];
  relatedChords: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Information panel showing chord theory details:
 * - Component notes and intervals
 * - Which musical keys contain this chord
 * - Related chords (sharing 2+ notes)
 *
 * Pure presentational -- all data comes from the hook via props.
 */
export default function ChordInfoPanel({
  chordSymbol,
  chordTones,
  keyAppearances,
  relatedChords,
}: ChordInfoPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Chord tones */}
      <InfoSection title="Chord Tones">
        {chordTones.length > 0 ? (
          <div className="space-y-1">
            {chordTones.map((tone) => (
              <div
                key={tone.semitones}
                className="flex items-center gap-3 py-1"
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    tone.semitones === 0
                      ? 'bg-amber-600 text-white'
                      : 'bg-cyan-700 text-white'
                  }`}
                >
                  {tone.note}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm text-white font-medium">
                    {tone.intervalName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {tone.abbreviation}
                    {tone.semitones > 0 &&
                      ` -- ${tone.semitones} semitone${tone.semitones !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-gray-500 text-sm">Select a chord to see its tones.</span>
        )}
      </InfoSection>

      {/* Key appearances */}
      <InfoSection title={`${chordSymbol} appears in`}>
        {keyAppearances.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {keyAppearances.map((ka) => (
              <span
                key={`${ka.key}-${ka.mode}`}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border bg-gray-700/50 border-gray-600/40"
              >
                <span className="text-white font-medium">
                  {ka.key} {ka.mode}
                </span>
                <span className="text-gray-400 font-mono">({ka.degree})</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-500 text-xs">
            This chord type does not appear naturally in major/minor keys.
          </span>
        )}
      </InfoSection>

      {/* Related chords */}
      <InfoSection title="Related Chords">
        {relatedChords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {relatedChords.map((chord) => (
              <span
                key={chord}
                className="px-2 py-1 rounded text-xs bg-gray-700/40 text-gray-300 border border-gray-600/30"
              >
                {chord}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-500 text-xs">No related chords found.</span>
        )}
      </InfoSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface InfoSectionProps {
  title: string;
  children: React.ReactNode;
}

function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <div className="bg-gray-800/60 rounded-lg border border-gray-700/50 p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
