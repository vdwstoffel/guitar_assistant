import type { getStarterChords } from '@/lib/chordSuggestions';

interface ChordStarterProps {
  starters: ReturnType<typeof getStarterChords>;
  onSelect: (chordName: string) => void;
}

export default function ChordStarter({ starters, onSelect }: ChordStarterProps) {
  return (
    <div>
      <p className="text-gray-400 text-sm mb-4 text-center">
        Pick a chord to start building your progression
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
        {starters.map(({ root, types }) => (
          <div key={root} className="flex flex-col gap-1">
            {types.map(({ name, quality }) => (
              <button
                key={name}
                onClick={() => onSelect(name)}
                className={`px-2 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
                  quality === 'Major'
                    ? 'bg-gray-800 text-gray-200 hover:bg-blue-600/30 hover:text-blue-300 border border-gray-700 hover:border-blue-500/50'
                    : 'bg-gray-800/60 text-gray-400 hover:bg-purple-600/20 hover:text-purple-300 border border-gray-700/60 hover:border-purple-500/50'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
