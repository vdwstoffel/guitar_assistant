import type { ChordSuggestions, SuggestedChord } from '@/lib/chordSuggestions';

interface SuggestionGridProps {
  suggestions: ChordSuggestions;
  onSelect: (chordName: string) => void;
}

export default function SuggestionGrid({ suggestions, onSelect }: SuggestionGridProps) {
  const { strongMoves, inKey, colorChords } = suggestions;
  const hasAnySuggestions = strongMoves.length > 0 || inKey.length > 0 || colorChords.length > 0;

  if (!hasAnySuggestions) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        No suggestions available. Try removing the last chord or starting over.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {strongMoves.length > 0 && (
        <SuggestionCategory
          title="Strong moves"
          description="Common next chords based on harmonic function"
          chords={strongMoves}
          variant="strong"
          onSelect={onSelect}
        />
      )}
      {inKey.length > 0 && (
        <SuggestionCategory
          title="In key"
          description="Other diatonic chords in the detected key"
          chords={inKey}
          variant="inkey"
          onSelect={onSelect}
        />
      )}
      {colorChords.length > 0 && (
        <SuggestionCategory
          title="Color chords"
          description="Secondary dominants and borrowed chords"
          chords={colorChords}
          variant="color"
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface SuggestionCategoryProps {
  title: string;
  description: string;
  chords: SuggestedChord[];
  variant: 'strong' | 'inkey' | 'color';
  onSelect: (chordName: string) => void;
}

const variantStyles = {
  strong: {
    chip: 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/40 hover:border-blue-400',
    numeral: 'text-blue-400/70',
  },
  inkey: {
    chip: 'bg-gray-700/60 text-gray-300 border-gray-600 hover:bg-gray-600/60 hover:border-gray-500',
    numeral: 'text-gray-500',
  },
  color: {
    chip: 'bg-purple-600/15 text-purple-300 border-purple-500/30 hover:bg-purple-600/30 hover:border-purple-400',
    numeral: 'text-purple-400/60',
  },
};

function SuggestionCategory({ title, description, chords, variant, onSelect }: SuggestionCategoryProps) {
  const styles = variantStyles[variant];

  return (
    <div>
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {chords.map((chord) => (
          <button
            key={chord.name + chord.numeral}
            onClick={() => onSelect(chord.name)}
            className={`flex flex-col items-center px-4 py-2.5 rounded-lg border transition-all hover:scale-105 ${styles.chip}`}
          >
            <span className="text-sm font-semibold">{chord.name}</span>
            <span className={`text-[10px] ${styles.numeral}`}>{chord.numeral}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
