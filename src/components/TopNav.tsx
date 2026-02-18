'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, memo } from 'react';

type Section = 'lessons' | 'videos' | 'fretboard' | 'intervals' | 'chords' | 'tools' | 'circle' | 'tabs' | 'jamtracks' | 'metrics';
type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8';

interface TopNavProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  onToggleMobileSidebar?: () => void;
}

const TopNav = memo(function TopNav({ activeSection, onSectionChange, onToggleMobileSidebar }: TopNavProps) {
  const [showMetronome, setShowMetronome] = useState(false);
  const [showTheory, setShowTheory] = useState(false);
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
  const theoryDropdownRef = useRef<HTMLDivElement>(null);

  const theoryItems: { id: Section; label: string; href: string }[] = [
    { id: 'fretboard', label: 'Fretboard', href: '/fretboard' },
    { id: 'intervals', label: 'Intervals', href: '/intervals' },
    { id: 'chords', label: 'Chords', href: '/chords' },
    { id: 'circle', label: 'Circle of 5ths', href: '/circle' },
  ];

  const isTheoryActive = activeSection === 'fretboard' || activeSection === 'intervals' || activeSection === 'chords' || activeSection === 'circle';

  // Close theory dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (theoryDropdownRef.current && !theoryDropdownRef.current.contains(e.target as Node)) {
        setShowTheory(false);
      }
    };
    if (showTheory) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTheory]);

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
      <nav className="bg-gray-800 border-b border-gray-700 px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2">
          {/* Hamburger menu - Mobile only */}
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="xl:hidden w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-md"
              title="Toggle sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Metronome button */}
          <button
            onClick={() => setShowMetronome(!showMetronome)}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showMetronome || isPlaying
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">Metronome</span>
            {isPlaying && (
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </button>

          {/* Centered nav items */}
          <div className="flex-1 flex gap-1 sm:gap-2 justify-center">
            <Link
              href="/"
              onClick={() => onSectionChange('lessons')}
              className={`px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeSection === 'lessons'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="hidden sm:inline">Lessons</span>
              <span className="sm:hidden">Lessons</span>
            </Link>
            <Link
              href="/jamtracks"
              onClick={() => onSectionChange('jamtracks')}
              className={`px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeSection === 'jamtracks'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span className="hidden sm:inline">Jam Tracks</span>
              <span className="sm:hidden">Jam</span>
            </Link>
            <Link
              href="/videos"
              onClick={() => onSectionChange('videos')}
              className={`px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeSection === 'videos'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Videos</span>
              <span className="sm:hidden">Vid</span>
            </Link>
            <Link
              href="/metrics"
              onClick={() => onSectionChange('metrics')}
              className={`px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeSection === 'metrics'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">Metrics</span>
              <span className="sm:hidden">Stats</span>
            </Link>

            {/* Theory dropdown */}
            <div className="relative" ref={theoryDropdownRef}>
              <button
                onClick={() => setShowTheory(!showTheory)}
                className={`flex items-center gap-1 px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isTheoryActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <span className="hidden sm:inline">Theory</span>
                <span className="sm:hidden">Thry</span>
                <svg className={`w-3 h-3 transition-transform ${showTheory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showTheory && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 min-w-40 z-50">
                  {theoryItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        onSectionChange(item.id);
                        setShowTheory(false);
                      }}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        activeSection === item.id
                          ? 'bg-gray-700 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/tools"
              onClick={() => onSectionChange('tools')}
              className={`px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeSection === 'tools'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Tools</span>
              <span className="sm:hidden">Tool</span>
            </Link>

            <Link
              href="/tabs"
              onClick={() => onSectionChange('tabs')}
              className={`px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeSection === 'tabs'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Tabs</span>
              <span className="sm:hidden">Tab</span>
            </Link>
          </div>

          {/* Spacer to balance the left side - Hide on mobile */}
          <div className="hidden xl:block xl:w-[120px]" />
        </div>
      </nav>

      {/* Mini Metronome Panel */}
      {showMetronome && (
        <div className="bg-gray-800 border-b border-gray-700 px-3 sm:px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
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
                className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
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
                className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
              >
                +
              </button>
              <span className="text-gray-400 text-sm">BPM</span>
            </div>

            {/* BPM Slider - Hide on mobile */}
            <input
              type="range"
              min="20"
              max="300"
              value={bpm}
              onChange={(e) => handleBpmChange(parseInt(e.target.value))}
              className="hidden sm:block w-24 md:w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />

            {/* Time Signature */}
            <div className="flex items-center gap-1">
              {(['4/4', '3/4', '2/4', '6/8'] as TimeSignature[]).map((sig) => (
                <button
                  key={sig}
                  onClick={() => setTimeSignature(sig)}
                  className={`px-3 py-1.5 sm:px-2 sm:py-1 rounded text-xs transition-colors ${
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
