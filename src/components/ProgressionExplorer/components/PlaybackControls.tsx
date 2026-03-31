interface PlaybackControlsProps {
  isPlaying: boolean;
  bpm: number;
  disabled: boolean;
  onToggle: () => void;
  onBpmChange: (bpm: number) => void;
}

export default function PlaybackControls({
  isPlaying,
  bpm,
  disabled,
  onToggle,
  onBpmChange,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`p-2 rounded-full transition-colors ${
          disabled
            ? 'text-gray-600 cursor-not-allowed'
            : isPlaying
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
        title={isPlaying ? 'Stop' : 'Play progression'}
      >
        {isPlaying ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        )}
      </button>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min="60"
          max="180"
          value={bpm}
          onChange={(e) => onBpmChange(parseInt(e.target.value))}
          className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <span className="text-gray-400 text-xs font-mono w-14">{bpm} bpm</span>
      </div>
    </div>
  );
}
