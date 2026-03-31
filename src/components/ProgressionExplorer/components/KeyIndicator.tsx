import type { MatchingKey } from '@/lib/chordSuggestions';

interface KeyIndicatorProps {
  matchingKeys: MatchingKey[];
}

export default function KeyIndicator({ matchingKeys }: KeyIndicatorProps) {
  if (matchingKeys.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        No common key detected
      </div>
    );
  }

  const primary = matchingKeys[0];
  const others = matchingKeys.slice(1, 4); // Show up to 3 alternatives

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-xs uppercase tracking-wider">Key</span>
        <span className="px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 text-sm font-semibold">
          {primary.key} {primary.mode}
        </span>
      </div>
      {others.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600 text-xs">also fits:</span>
          {others.map((k) => (
            <span key={k.key} className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 text-xs">
              {k.key} {k.mode}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
