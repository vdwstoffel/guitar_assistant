'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, memo } from 'react';

type Section = 'library' | 'videos' | 'fretboard' | 'tools';
type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8';

interface TopNavProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

const TopNav = memo(function TopNav({ activeSection, onSectionChange }: TopNavProps) {
  const [showMetronome, setShowMetronome] = useState(false);
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

  const sections: { id: Section; label: string; href: string }[] = [
    { id: 'library', label: 'Library', href: '/' },
    { id: 'videos', label: 'Videos', href: '/videos' },
    { id: 'fretboard', label: 'Fretboard', href: '/fretboard' },
    { id: 'tools', label: 'Tools', href: '/tools' },
  ];

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
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { timeSignatureRef.current = timeSignature; }, [timeSignature]);

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
    <div className="flex-shrink-0">
      <nav className="bg-gray-800 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center">
          {/* Metronome button on the left */}
          <button
            onClick={() => setShowMetronome(!showMetronome)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showMetronome || isPlaying
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Metronome</span>
            {isPlaying && (
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </button>

          {/* Centered nav items */}
          <div className="flex-1 flex gap-1 justify-center">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={section.href}
                onClick={() => onSectionChange(section.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {section.label}
              </Link>
            ))}
          </div>

          {/* Spacer to balance the metronome button */}
          <div className="w-[120px]" />
        </div>
      </nav>

      {/* Mini Metronome Panel */}
      {showMetronome && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-center gap-6">
            {/* Beat Indicator */}
            <div className="flex gap-1.5">
              {Array.from({ length: beatsPerMeasure }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    isPlaying && currentBeat === i
                      ? i === 0
                        ? 'bg-red-500 scale-125'
                        : 'bg-blue-500 scale-125'
                      : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            {/* BPM Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBpmChange(bpm - 5)}
                className="w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
              >
                −
              </button>
              <input
                type="number"
                min="20"
                max="300"
                value={bpm}
                onChange={(e) => handleBpmChange(parseInt(e.target.value) || 20)}
                className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-center text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleBpmChange(bpm + 5)}
                className="w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
              >
                +
              </button>
              <span className="text-gray-400 text-sm">BPM</span>
            </div>

            {/* BPM Slider */}
            <input
              type="range"
              min="20"
              max="300"
              value={bpm}
              onChange={(e) => handleBpmChange(parseInt(e.target.value))}
              className="w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />

            {/* Time Signature */}
            <div className="flex items-center gap-1">
              {(['4/4', '3/4', '2/4', '6/8'] as TimeSignature[]).map((sig) => (
                <button
                  key={sig}
                  onClick={() => setTimeSignature(sig)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    timeSignature === sig
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {sig}
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isPlaying
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isPlaying ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default TopNav;
