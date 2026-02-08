'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  useProgressionPlayer,
  useCustomProgression,
  ProgressionPlayback,
  CustomProgressionBuilder,
  NashvilleToggle,
  ROMAN_TO_NASHVILLE_MAJOR,
  ROMAN_TO_NASHVILLE_MINOR,
} from './CircleEnhancements';
import type { NotationMode } from './CircleEnhancements';

// Circle of fifths order - clockwise from C at 12 o'clock.
// NOTE: These key arrays use enharmonic/flat spellings (Gb, Db, Ebm, etc.)
// which differ from the sharps-only NOTES constant in @/lib/musicTheory.
// The Circle of Fifths intentionally preserves music-theory-correct spellings
// so that key signatures display properly (e.g. "Bb major" not "A# major").
const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const MINOR_KEYS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

interface KeyInfo {
  enharmonic?: string;
  relativeMinor?: string;
  relativeMajor?: string;
  signature: string;
  sharps: number;
  flats: number;
  scaleNotes: string[];
  diatonicChords: string[];
  chordQualities: string[];
}

const KEY_DATA: Record<string, KeyInfo> = {
  // Major keys
  'C':  { relativeMinor: 'Am',  sharps: 0, flats: 0, signature: 'No sharps or flats',
           scaleNotes: ['C','D','E','F','G','A','B'],
           diatonicChords: ['C','Dm','Em','F','G','Am','Bdim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'G':  { relativeMinor: 'Em',  sharps: 1, flats: 0, signature: '1 sharp: F#',
           scaleNotes: ['G','A','B','C','D','E','F#'],
           diatonicChords: ['G','Am','Bm','C','D','Em','F#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'D':  { relativeMinor: 'Bm',  sharps: 2, flats: 0, signature: '2 sharps: F#, C#',
           scaleNotes: ['D','E','F#','G','A','B','C#'],
           diatonicChords: ['D','Em','F#m','G','A','Bm','C#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'A':  { relativeMinor: 'F#m', sharps: 3, flats: 0, signature: '3 sharps: F#, C#, G#',
           scaleNotes: ['A','B','C#','D','E','F#','G#'],
           diatonicChords: ['A','Bm','C#m','D','E','F#m','G#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'E':  { relativeMinor: 'C#m', sharps: 4, flats: 0, signature: '4 sharps: F#, C#, G#, D#',
           scaleNotes: ['E','F#','G#','A','B','C#','D#'],
           diatonicChords: ['E','F#m','G#m','A','B','C#m','D#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'B':  { relativeMinor: 'G#m', sharps: 5, flats: 0, signature: '5 sharps: F#, C#, G#, D#, A#',
           scaleNotes: ['B','C#','D#','E','F#','G#','A#'],
           diatonicChords: ['B','C#m','D#m','E','F#','G#m','A#dim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Gb': { enharmonic: 'F#', relativeMinor: 'Ebm', sharps: 0, flats: 6, signature: '6 flats: Bb, Eb, Ab, Db, Gb, Cb',
           scaleNotes: ['Gb','Ab','Bb','Cb','Db','Eb','F'],
           diatonicChords: ['Gb','Abm','Bbm','Cb','Db','Ebm','Fdim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Db': { enharmonic: 'C#', relativeMinor: 'Bbm', sharps: 0, flats: 5, signature: '5 flats: Bb, Eb, Ab, Db, Gb',
           scaleNotes: ['Db','Eb','F','Gb','Ab','Bb','C'],
           diatonicChords: ['Db','Ebm','Fm','Gb','Ab','Bbm','Cdim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Ab': { relativeMinor: 'Fm',  sharps: 0, flats: 4, signature: '4 flats: Bb, Eb, Ab, Db',
           scaleNotes: ['Ab','Bb','C','Db','Eb','F','G'],
           diatonicChords: ['Ab','Bbm','Cm','Db','Eb','Fm','Gdim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Eb': { relativeMinor: 'Cm',  sharps: 0, flats: 3, signature: '3 flats: Bb, Eb, Ab',
           scaleNotes: ['Eb','F','G','Ab','Bb','C','D'],
           diatonicChords: ['Eb','Fm','Gm','Ab','Bb','Cm','Ddim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'Bb': { relativeMinor: 'Gm',  sharps: 0, flats: 2, signature: '2 flats: Bb, Eb',
           scaleNotes: ['Bb','C','D','Eb','F','G','A'],
           diatonicChords: ['Bb','Cm','Dm','Eb','F','Gm','Adim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  'F':  { relativeMinor: 'Dm',  sharps: 0, flats: 1, signature: '1 flat: Bb',
           scaleNotes: ['F','G','A','Bb','C','D','E'],
           diatonicChords: ['F','Gm','Am','Bb','C','Dm','Edim'],
           chordQualities: ['I','ii','iii','IV','V','vi','vii\u00B0'] },
  // Minor keys (natural minor / Aeolian)
  'Am':  { relativeMajor: 'C',  sharps: 0, flats: 0, signature: 'No sharps or flats',
            scaleNotes: ['A','B','C','D','E','F','G'],
            diatonicChords: ['Am','Bdim','C','Dm','Em','F','G'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Em':  { relativeMajor: 'G',  sharps: 1, flats: 0, signature: '1 sharp: F#',
            scaleNotes: ['E','F#','G','A','B','C','D'],
            diatonicChords: ['Em','F#dim','G','Am','Bm','C','D'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Bm':  { relativeMajor: 'D',  sharps: 2, flats: 0, signature: '2 sharps: F#, C#',
            scaleNotes: ['B','C#','D','E','F#','G','A'],
            diatonicChords: ['Bm','C#dim','D','Em','F#m','G','A'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'F#m': { relativeMajor: 'A',  sharps: 3, flats: 0, signature: '3 sharps: F#, C#, G#',
            scaleNotes: ['F#','G#','A','B','C#','D','E'],
            diatonicChords: ['F#m','G#dim','A','Bm','C#m','D','E'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'C#m': { relativeMajor: 'E',  sharps: 4, flats: 0, signature: '4 sharps: F#, C#, G#, D#',
            scaleNotes: ['C#','D#','E','F#','G#','A','B'],
            diatonicChords: ['C#m','D#dim','E','F#m','G#m','A','B'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'G#m': { enharmonic: 'Abm', relativeMajor: 'B', sharps: 5, flats: 0, signature: '5 sharps: F#, C#, G#, D#, A#',
            scaleNotes: ['G#','A#','B','C#','D#','E','F#'],
            diatonicChords: ['G#m','A#dim','B','C#m','D#m','E','F#'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Ebm': { enharmonic: 'D#m', relativeMajor: 'Gb', sharps: 0, flats: 6, signature: '6 flats: Bb, Eb, Ab, Db, Gb, Cb',
            scaleNotes: ['Eb','F','Gb','Ab','Bb','Cb','Db'],
            diatonicChords: ['Ebm','Fdim','Gb','Abm','Bbm','Cb','Db'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Bbm': { relativeMajor: 'Db', sharps: 0, flats: 5, signature: '5 flats: Bb, Eb, Ab, Db, Gb',
            scaleNotes: ['Bb','C','Db','Eb','F','Gb','Ab'],
            diatonicChords: ['Bbm','Cdim','Db','Ebm','Fm','Gb','Ab'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Fm':  { relativeMajor: 'Ab', sharps: 0, flats: 4, signature: '4 flats: Bb, Eb, Ab, Db',
            scaleNotes: ['F','G','Ab','Bb','C','Db','Eb'],
            diatonicChords: ['Fm','Gdim','Ab','Bbm','Cm','Db','Eb'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Cm':  { relativeMajor: 'Eb', sharps: 0, flats: 3, signature: '3 flats: Bb, Eb, Ab',
            scaleNotes: ['C','D','Eb','F','G','Ab','Bb'],
            diatonicChords: ['Cm','Ddim','Eb','Fm','Gm','Ab','Bb'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Gm':  { relativeMajor: 'Bb', sharps: 0, flats: 2, signature: '2 flats: Bb, Eb',
            scaleNotes: ['G','A','Bb','C','D','Eb','F'],
            diatonicChords: ['Gm','Adim','Bb','Cm','Dm','Eb','F'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
  'Dm':  { relativeMajor: 'F',  sharps: 0, flats: 1, signature: '1 flat: Bb',
            scaleNotes: ['D','E','F','G','A','Bb','C'],
            diatonicChords: ['Dm','Edim','F','Gm','Am','Bb','C'],
            chordQualities: ['i','ii\u00B0','III','iv','v','VI','VII'] },
};

// Scale degree labels for outer ring (offsets from selected key on the circle)
const MAJOR_DEGREES = [
  { offset: 0,  numeral: 'I',     name: 'tonic' },
  { offset: 1,  numeral: 'V',     name: 'dominant' },
  { offset: 2,  numeral: 'ii',    name: 'supertonic' },
  { offset: 3,  numeral: 'vi',    name: 'submediant' },
  { offset: 4,  numeral: 'iii',   name: 'mediant' },
  { offset: 5,  numeral: 'vii\u00B0', name: 'leading tone' },
  { offset: 11, numeral: 'IV',    name: 'subdominant' },
];

const MINOR_DEGREES = [
  { offset: 0,  numeral: 'i',     name: 'tonic' },
  { offset: 1,  numeral: 'v',     name: 'dominant' },
  { offset: 2,  numeral: 'ii\u00B0',  name: 'supertonic' },
  { offset: 3,  numeral: 'VI',    name: 'submediant' },
  { offset: 4,  numeral: 'III',   name: 'mediant' },
  { offset: 5,  numeral: 'VII',   name: 'subtonic' },
  { offset: 11, numeral: 'iv',    name: 'subdominant' },
];

const COMMON_PROGRESSIONS = [
  { name: 'I - IV - V - I',        indices: [0, 3, 4, 0],  label: 'Classic' },
  { name: 'I - V - vi - IV',       indices: [0, 4, 5, 3],  label: 'Pop' },
  { name: 'I - vi - IV - V',       indices: [0, 5, 3, 4],  label: '50s' },
  { name: 'ii - V - I',            indices: [1, 4, 0],      label: 'Jazz' },
  { name: 'I - IV - vi - V',       indices: [0, 3, 5, 4],  label: 'Alternative' },
  { name: 'vi - IV - I - V',       indices: [5, 3, 0, 4],  label: 'Minor Feel' },
  { name: 'I - V - vi - iii - IV', indices: [0, 4, 5, 2, 3], label: 'Canon' },
];

// SVG geometry constants
const CX = 300;
const CY = 300;
const DEGREE_R = 330;
const OUTER_R = 250;
const OUTER_INNER_R = 190;
const INNER_INNER_R = 130;
const NUM_SEGMENTS = 12;
const SEGMENT_ANGLE = (2 * Math.PI) / NUM_SEGMENTS;

function getWedgePath(index: number, outerR: number, innerR: number): string {
  const startAngle = (index - 0.5) * SEGMENT_ANGLE - Math.PI / 2;
  const endAngle = (index + 0.5) * SEGMENT_ANGLE - Math.PI / 2;

  const ox1 = CX + outerR * Math.cos(startAngle);
  const oy1 = CY + outerR * Math.sin(startAngle);
  const ox2 = CX + outerR * Math.cos(endAngle);
  const oy2 = CY + outerR * Math.sin(endAngle);
  const ix1 = CX + innerR * Math.cos(endAngle);
  const iy1 = CY + innerR * Math.sin(endAngle);
  const ix2 = CX + innerR * Math.cos(startAngle);
  const iy2 = CY + innerR * Math.sin(startAngle);

  return `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 0 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 0 0 ${ix2} ${iy2} Z`;
}

function getLabelPos(index: number, radius: number): { x: number; y: number } {
  const angle = index * SEGMENT_ANGLE - Math.PI / 2;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

/** Progression tab modes. */
type ProgressionTab = 'presets' | 'custom';

export default function CircleOfFifths() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [notationMode, setNotationMode] = useState<NotationMode>('roman');
  const [progressionTab, setProgressionTab] = useState<ProgressionTab>('presets');
  /** Tracks which preset progression (by label) is currently being played, or null. */
  const [activePresetLabel, setActivePresetLabel] = useState<string | null>(null);

  const player = useProgressionPlayer();
  const customProg = useCustomProgression();

  const isMajorKey = (key: string) => MAJOR_KEYS.includes(key);

  const getRelative = (key: string): string | undefined => {
    const info = KEY_DATA[key];
    if (!info) return undefined;
    return isMajorKey(key) ? info.relativeMinor : info.relativeMajor;
  };

  const getNeighborKeys = (key: string): string[] => {
    const keys = isMajorKey(key) ? MAJOR_KEYS : MINOR_KEYS;
    const idx = keys.indexOf(key);
    if (idx === -1) return [];
    const prev = keys[(idx - 1 + 12) % 12]; // IV direction
    const next = keys[(idx + 1) % 12];       // V direction
    return [prev, next];
  };

  const getSegmentFill = (key: string, ring: 'major' | 'minor'): string => {
    const isSelected = key === selectedKey;
    const isHovered = key === hoveredKey;

    if (selectedKey) {
      const relative = getRelative(selectedKey);
      const neighbors = getNeighborKeys(selectedKey);
      if (isSelected) return 'hsl(210, 80%, 50%)';
      if (key === relative) return 'hsl(280, 60%, 40%)';
      if (neighbors.includes(key)) return 'hsl(210, 50%, 32%)';
    }

    if (isHovered) {
      return ring === 'major' ? 'hsl(220, 20%, 35%)' : 'hsl(220, 20%, 28%)';
    }
    return ring === 'major' ? 'hsl(220, 15%, 25%)' : 'hsl(220, 15%, 18%)';
  };

  const getTextFill = (key: string): string => {
    if (key === selectedKey) return '#ffffff';
    if (selectedKey) {
      const relative = getRelative(selectedKey);
      const neighbors = getNeighborKeys(selectedKey);
      if (key === relative || neighbors.includes(key)) return '#ffffff';
    }
    return 'hsl(220, 10%, 70%)';
  };

  const selectedInfo = selectedKey ? KEY_DATA[selectedKey] : null;

  // Build Nashville lookup map for the selected key
  const nashvilleMap = useMemo(() => {
    if (!selectedKey) return ROMAN_TO_NASHVILLE_MAJOR;
    return isMajorKey(selectedKey) ? ROMAN_TO_NASHVILLE_MAJOR : ROMAN_TO_NASHVILLE_MINOR;
  }, [selectedKey]);

  /** Diatonic chord display data (chord name, roman, nashville) for the selected key. */
  const diatonicChordData = useMemo(() => {
    if (!selectedInfo) return [];
    return selectedInfo.diatonicChords.map((chordName, i) => ({
      chordName,
      romanNumeral: selectedInfo.chordQualities[i],
      nashvilleNumber: nashvilleMap[selectedInfo.chordQualities[i]] ?? String(i + 1),
    }));
  }, [selectedInfo, nashvilleMap]);

  /** Stop playback when key changes. */
  const handleKeyClick = (key: string) => {
    setSelectedKey(prev => {
      const newKey = prev === key ? null : key;
      // Stop any playing progression when switching keys
      if (newKey !== prev) {
        player.stopPlayback();
        setActivePresetLabel(null);
      }
      return newKey;
    });
  };

  /** Toggle preset progression playback. */
  const handlePresetToggle = useCallback((label: string, chordNames: string[]) => {
    if (activePresetLabel === label && player.isPlaying) {
      // Stop current
      player.stopPlayback();
      setActivePresetLabel(null);
    } else {
      // Stop any current playback, then start this one
      player.stopPlayback();
      setActivePresetLabel(label);
      // Small delay so the stop registers before re-starting
      setTimeout(() => {
        player.togglePlayback(chordNames);
      }, 10);
    }
  }, [activePresetLabel, player]);

  /** Toggle custom progression playback. */
  const handleCustomToggle = useCallback(() => {
    if (!selectedInfo) return;
    const chordNames = customProg.chords.map(c => selectedInfo.diatonicChords[c.diatonicIndex]);
    if (chordNames.length === 0) return;
    setActivePresetLabel(null); // Clear any preset
    player.togglePlayback(chordNames);
  }, [customProg.chords, selectedInfo, player]);

  /** Whether custom progression is currently playing. */
  const isCustomPlaying = player.isPlaying && activePresetLabel === null;

  // Calculate rotation so selected key is always at the top (12 o'clock)
  const getRotationDeg = (): number => {
    if (!selectedKey) return 0;
    const majorIdx = MAJOR_KEYS.indexOf(selectedKey);
    const minorIdx = MINOR_KEYS.indexOf(selectedKey);
    const idx = majorIdx !== -1 ? majorIdx : minorIdx;
    if (idx === -1) return 0;
    return idx * 30; // 360 / 12 = 30 degrees per segment
  };
  const rotationDeg = getRotationDeg();

  const majorLabelR = (OUTER_R + OUTER_INNER_R) / 2;
  const minorLabelR = (OUTER_INNER_R + INNER_INNER_R) / 2;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
      <div className="flex-1 flex items-center justify-center min-h-0 gap-8 px-8">
          <svg viewBox="-40 -40 680 680" className="w-full h-full" style={{ maxWidth: '90vh', maxHeight: '90vh' }}>
              {/* Rotating ring group - rotates so selected key is at 12 o'clock */}
              <g style={{
                transform: `rotate(${-rotationDeg}deg)`,
                transformOrigin: `${CX}px ${CY}px`,
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              }}>
                {/* Outer ring (major keys) */}
                {MAJOR_KEYS.map((key, i) => {
                  const path = getWedgePath(i, OUTER_R, OUTER_INNER_R);
                  const label = getLabelPos(i, majorLabelR);
                  const displayName = KEY_DATA[key]?.enharmonic ? `${key}/${KEY_DATA[key].enharmonic}` : key;
                  return (
                    <g key={`major-${key}`}
                       onClick={() => handleKeyClick(key)}
                       onMouseEnter={() => setHoveredKey(key)}
                       onMouseLeave={() => setHoveredKey(null)}
                       className="cursor-pointer"
                    >
                      <path
                        d={path}
                        fill={getSegmentFill(key, 'major')}
                        stroke="hsl(220, 10%, 35%)"
                        strokeWidth="1.5"
                        style={{ transition: 'fill 0.2s ease' }}
                      />
                      <text
                        x={label.x} y={label.y}
                        textAnchor="middle" dominantBaseline="central"
                        fill={getTextFill(key)}
                        fontSize={displayName.length > 3 ? "17" : "22"}
                        fontWeight="bold"
                        className="pointer-events-none select-none"
                        style={{
                          transition: 'fill 0.2s ease, transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: `rotate(${rotationDeg}deg)`,
                          transformOrigin: `${label.x}px ${label.y}px`,
                        }}
                      >
                        {displayName}
                      </text>
                    </g>
                  );
                })}

                {/* Inner ring (minor keys) */}
                {MINOR_KEYS.map((key, i) => {
                  const path = getWedgePath(i, OUTER_INNER_R, INNER_INNER_R);
                  const label = getLabelPos(i, minorLabelR);
                  const displayName = KEY_DATA[key]?.enharmonic ? `${key}/${KEY_DATA[key].enharmonic}` : key;
                  return (
                    <g key={`minor-${key}`}
                       onClick={() => handleKeyClick(key)}
                       onMouseEnter={() => setHoveredKey(key)}
                       onMouseLeave={() => setHoveredKey(null)}
                       className="cursor-pointer"
                    >
                      <path
                        d={path}
                        fill={getSegmentFill(key, 'minor')}
                        stroke="hsl(220, 10%, 30%)"
                        strokeWidth="1"
                        style={{ transition: 'fill 0.2s ease' }}
                      />
                      <text
                        x={label.x} y={label.y}
                        textAnchor="middle" dominantBaseline="central"
                        fill={getTextFill(key)}
                        fontSize={displayName.length > 5 ? "13" : "17"}
                        fontWeight="600"
                        className="pointer-events-none select-none"
                        style={{
                          transition: 'fill 0.2s ease, transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: `rotate(${rotationDeg}deg)`,
                          transformOrigin: `${label.x}px ${label.y}px`,
                        }}
                      >
                        {displayName}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Degree ring - static outer ring showing scale degrees when key selected */}
              {selectedKey && (
                <g style={{ opacity: 1, transition: 'opacity 0.3s ease' }}>
                  {(isMajorKey(selectedKey) ? MAJOR_DEGREES : MINOR_DEGREES).map((deg) => {
                    const wedgePath = getWedgePath(deg.offset, DEGREE_R, OUTER_R);
                    const angle = deg.offset * SEGMENT_ANGLE - Math.PI / 2;
                    const numeralR = (OUTER_R + DEGREE_R) / 2 - 10;
                    const nameR = (OUTER_R + DEGREE_R) / 2 + 14;
                    const nx = CX + numeralR * Math.cos(angle);
                    const ny = CY + numeralR * Math.sin(angle);
                    const dx = CX + nameR * Math.cos(angle);
                    const dy = CY + nameR * Math.sin(angle);
                    const angleDeg = deg.offset * 30;
                    const flip = angleDeg > 100 && angleDeg < 260;
                    const textRot = flip ? angleDeg + 180 : angleDeg;

                    return (
                      <g key={`deg-${deg.offset}`}>
                        <path
                          d={wedgePath}
                          fill={deg.offset === 0 ? 'hsl(15, 55%, 35%)' : 'hsl(200, 25%, 20%)'}
                          stroke="hsl(220, 10%, 28%)"
                          strokeWidth="1"
                        />
                        <text
                          x={nx} y={ny}
                          textAnchor="middle" dominantBaseline="central"
                          fill={deg.offset === 0 ? '#ffffff' : 'hsl(200, 60%, 72%)'}
                          fontSize="20" fontWeight="bold"
                          transform={`rotate(${textRot}, ${nx}, ${ny})`}
                          className="pointer-events-none select-none"
                        >
                          {deg.numeral}
                        </text>
                        <text
                          x={dx} y={dy}
                          textAnchor="middle" dominantBaseline="central"
                          fill={deg.offset === 0 ? 'hsl(15, 70%, 72%)' : 'hsl(200, 35%, 52%)'}
                          fontSize="10"
                          transform={`rotate(${textRot}, ${dx}, ${dy})`}
                          className="pointer-events-none select-none"
                        >
                          {deg.name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Center circle */}
              <circle cx={CX} cy={CY} r={INNER_INNER_R} fill="hsl(220, 15%, 12%)" stroke="hsl(220, 10%, 30%)" strokeWidth="1.5" />

              {selectedKey && selectedInfo ? (
                <>
                  <text x={CX} y={CY - 40} textAnchor="middle" dominantBaseline="central"
                        fill="white" fontSize="36" fontWeight="bold" className="select-none">
                    {selectedKey}
                    {selectedInfo.enharmonic && (
                      <tspan fontSize="20" fill="hsl(220, 10%, 60%)"> / {selectedInfo.enharmonic}</tspan>
                    )}
                  </text>
                  <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central"
                        fill="hsl(220, 10%, 70%)" fontSize="16" className="select-none">
                    {isMajorKey(selectedKey) ? 'Major' : 'Minor'}
                  </text>
                  <text x={CX} y={CY + 28} textAnchor="middle" dominantBaseline="central"
                        fill="hsl(220, 10%, 55%)" fontSize="13" className="select-none">
                    {selectedInfo.signature}
                  </text>
                  <text x={CX} y={CY + 55} textAnchor="middle" dominantBaseline="central"
                        fill="hsl(280, 60%, 65%)" fontSize="13" className="select-none">
                    Relative: {isMajorKey(selectedKey) ? selectedInfo.relativeMinor : selectedInfo.relativeMajor}
                  </text>
                </>
              ) : (
                <>
                  <text x={CX} y={CY - 12} textAnchor="middle" dominantBaseline="central"
                        fill="hsl(220, 10%, 50%)" fontSize="18" className="select-none">
                    Select
                  </text>
                  <text x={CX} y={CY + 14} textAnchor="middle" dominantBaseline="central"
                        fill="hsl(220, 10%, 50%)" fontSize="18" className="select-none">
                    a Key
                  </text>
                </>
              )}
          </svg>

        {/* Progressions card on the right */}
        {selectedKey && selectedInfo && (
          <div className="shrink-0 flex flex-col gap-3 max-h-full overflow-y-auto">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-5 w-80">
              {/* Header with notation toggle */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Progressions</h3>
                <NashvilleToggle mode={notationMode} onModeChange={setNotationMode} />
              </div>

              {/* BPM control */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Tempo</span>
                <input
                  type="range"
                  min="60"
                  max="180"
                  value={player.bpm}
                  onChange={(e) => player.setBpm(parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-gray-400 text-xs font-mono w-12 text-right">{player.bpm} bpm</span>
              </div>

              {/* Tab switcher: Presets / Custom */}
              <div className="flex gap-1 mb-3 bg-gray-900/50 rounded-md p-0.5">
                <button
                  onClick={() => setProgressionTab('presets')}
                  className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    progressionTab === 'presets'
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Presets
                </button>
                <button
                  onClick={() => setProgressionTab('custom')}
                  className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    progressionTab === 'custom'
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Tab content */}
              {progressionTab === 'presets' ? (
                <div className="space-y-3">
                  {COMMON_PROGRESSIONS.map((prog) => {
                    const chords = prog.indices.map(i => ({
                      chordName: selectedInfo.diatonicChords[i],
                      romanNumeral: selectedInfo.chordQualities[i],
                      nashvilleNumber: nashvilleMap[selectedInfo.chordQualities[i]] ?? String(i + 1),
                    }));
                    const chordNames = chords.map(c => c.chordName);
                    const isThisPlaying = player.isPlaying && activePresetLabel === prog.label;
                    return (
                      <ProgressionPlayback
                        key={prog.label}
                        label={prog.label}
                        formula={prog.name}
                        chords={chords}
                        isPlaying={isThisPlaying}
                        activeChordIndex={isThisPlaying ? player.activeChordIndex : null}
                        notationMode={notationMode}
                        onTogglePlayback={() => handlePresetToggle(prog.label, chordNames)}
                      />
                    );
                  })}
                </div>
              ) : (
                <CustomProgressionBuilder
                  diatonicChords={diatonicChordData}
                  progression={customProg.chords}
                  notationMode={notationMode}
                  isPlaying={isCustomPlaying}
                  activeChordIndex={isCustomPlaying ? player.activeChordIndex : null}
                  onAddChord={customProg.addChord}
                  onRemoveChord={customProg.removeChord}
                  onClear={customProg.clearAll}
                  onTogglePlayback={handleCustomToggle}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compact info bar at bottom */}
      {selectedKey && selectedInfo && (
        <div className="border-t border-gray-700 bg-gray-800 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 justify-center">
          {/* Scale Notes */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm uppercase tracking-wider">Scale</span>
            <div className="flex gap-1.5">
              {selectedInfo.scaleNotes.map((note, i) => (
                <span key={i}
                      className={`px-2.5 py-1 rounded text-sm font-semibold ${
                        i === 0 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                      }`}>
                  {note}
                </span>
              ))}
            </div>
          </div>

          {/* Diatonic Chords */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm uppercase tracking-wider">Chords</span>
            <div className="flex gap-1.5">
              {selectedInfo.diatonicChords.map((chord, i) => (
                <span key={i} className="text-white text-sm font-medium">
                  {chord}{i < 6 ? <span className="text-gray-600 mx-0.5">-</span> : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
