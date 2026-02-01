'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8';

const TIME_SIGNATURES: { value: TimeSignature; label: string }[] = [
  { value: '4/4', label: '4/4' },
  { value: '3/4', label: '3/4' },
  { value: '2/4', label: '2/4' },
  { value: '6/8', label: '6/8' },
];

export default function Metronome() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>('4/4');
  const [currentBeat, setCurrentBeat] = useState(0);
  const [volume, setVolume] = useState(100);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const timerIdRef = useRef<number | null>(null);
  const currentBeatRef = useRef(0);
  const volumeRef = useRef(100);
  const bpmRef = useRef(bpm);
  const timeSignatureRef = useRef(timeSignature);

  const getBeatsPerMeasure = (sig: TimeSignature): number => {
    switch (sig) {
      case '4/4': return 4;
      case '3/4': return 3;
      case '2/4': return 2;
      case '6/8': return 6;
      default: return 4;
    }
  };

  // Keep refs in sync
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    timeSignatureRef.current = timeSignature;
  }, [timeSignature]);

  const playClick = useCallback((time: number, isAccent: boolean) => {
    if (!audioContextRef.current) return;

    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();

    osc.connect(gain);
    gain.connect(audioContextRef.current.destination);

    const vol = volumeRef.current / 100;
    const gainValue = (isAccent ? 2.0 : 1.4) * vol;

    osc.frequency.value = isAccent ? 1000 : 800;
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  const scheduleNote = useCallback(() => {
    if (!audioContextRef.current) return;

    const beatsPerMeasure = getBeatsPerMeasure(timeSignatureRef.current);
    const secondsPerBeat = 60.0 / bpmRef.current;
    const scheduleAheadTime = 0.1;

    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + scheduleAheadTime) {
      const isAccent = currentBeatRef.current === 0;
      playClick(nextNoteTimeRef.current, isAccent);
      setCurrentBeat(currentBeatRef.current);

      currentBeatRef.current = (currentBeatRef.current + 1) % beatsPerMeasure;
      nextNoteTimeRef.current += secondsPerBeat;
    }
  }, [playClick]);

  const startMetronome = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    currentBeatRef.current = 0;
    setCurrentBeat(0);
    nextNoteTimeRef.current = audioContextRef.current.currentTime;

    const scheduler = () => {
      scheduleNote();
      timerIdRef.current = window.setTimeout(scheduler, 25);
    };

    scheduler();
    setIsPlaying(true);
  }, [scheduleNote]);

  const stopMetronome = useCallback(() => {
    if (timerIdRef.current !== null) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(0);
    currentBeatRef.current = 0;
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  }, [isPlaying, startMetronome, stopMetronome]);

  // Spacebar handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIdRef.current !== null) {
        clearTimeout(timerIdRef.current);
      }
    };
  }, []);

  const handleBpmChange = (value: number) => {
    const clampedValue = Math.min(300, Math.max(20, value));
    setBpm(clampedValue);
  };

  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md p-8">
        {/* Beat Indicator */}
        <div className="flex justify-center gap-3 mb-8">
          {Array.from({ length: beatsPerMeasure }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all ${
                isPlaying && currentBeat === i
                  ? i === 0
                    ? 'bg-red-500 scale-125'
                    : 'bg-blue-500 scale-125'
                  : 'bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* BPM Display */}
        <div className="text-center mb-6">
          <div className="text-6xl font-bold text-white mb-2">{bpm}</div>
          <div className="text-gray-400 text-sm">BPM</div>
        </div>

        {/* BPM Slider */}
        <div className="mb-6">
          <input
            type="range"
            min="20"
            max="300"
            value={bpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>20</span>
            <span>300</span>
          </div>
        </div>

        {/* BPM Input */}
        <div className="flex justify-center mb-8">
          <input
            type="number"
            min="20"
            max="300"
            value={bpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value) || 20)}
            className="w-24 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-center focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Time Signature */}
        <div className="mb-8">
          <div className="text-gray-400 text-sm mb-3 text-center">Time Signature</div>
          <div className="flex justify-center gap-2">
            {TIME_SIGNATURES.map((sig) => (
              <label
                key={sig.value}
                className={`px-4 py-2 rounded cursor-pointer transition-colors ${
                  timeSignature === sig.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="timeSignature"
                  value={sig.value}
                  checked={timeSignature === sig.value}
                  onChange={(e) => setTimeSignature(e.target.value as TimeSignature)}
                  className="sr-only"
                />
                {sig.label}
              </label>
            ))}
          </div>
        </div>

        {/* Volume Control */}
        <div className="mb-8">
          <div className="text-gray-400 text-sm mb-3 text-center">Volume</div>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </div>
        </div>

        {/* Play/Pause Button */}
        <div className="flex justify-center">
          <button
            onClick={togglePlay}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isPlaying ? (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>
        </div>

        {/* Spacebar hint */}
        <div className="text-center mt-4 text-gray-500 text-sm">
          Press <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">Space</kbd> to toggle
        </div>
      </div>
    </div>
  );
}
