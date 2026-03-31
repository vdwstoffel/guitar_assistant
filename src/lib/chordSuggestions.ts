/**
 * Chord suggestion engine for the Progression Explorer.
 *
 * Given a progression of chords, finds matching keys and suggests
 * next chords ranked by functional harmony patterns.
 */

import { KEY_DATA, isMajorKey } from './keyData';
import { getNoteIndex, getNoteName } from './musicTheory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchingKey {
  key: string;
  mode: 'Major' | 'Minor';
  /** Maps each chord in the progression to its degree index (0-6) in this key. */
  chordDegrees: number[];
}

export interface SuggestedChord {
  name: string;
  /** Roman numeral in the primary matching key (e.g. "IV", "vi"). */
  numeral: string;
  /** Degree index (0-6) in the primary key. */
  degreeIndex: number;
  /** The key this suggestion comes from. */
  fromKey: string;
}

export interface ChordSuggestions {
  /** Chords that commonly follow the last chord in the progression. */
  strongMoves: SuggestedChord[];
  /** Other diatonic chords in the matching key(s). */
  inKey: SuggestedChord[];
  /** Secondary dominants and borrowed chords for color. */
  colorChords: SuggestedChord[];
}

// ---------------------------------------------------------------------------
// Chord Movement Map (functional harmony patterns)
// ---------------------------------------------------------------------------

/**
 * Common chord movements in major keys.
 * Maps degree index (0=I, 1=ii, ..., 6=vii) to arrays of likely next degrees.
 * Ordered by strength/commonality.
 */
const MAJOR_MOVEMENTS: Record<number, number[]> = {
  0: [3, 4, 5, 1, 2],    // I  -> IV, V, vi, ii, iii
  1: [4, 3, 0],           // ii -> V, IV, I
  2: [5, 3, 1],           // iii -> vi, IV, ii
  3: [4, 0, 1, 5],        // IV -> V, I, ii, vi
  4: [0, 5, 3],           // V  -> I, vi, IV
  5: [3, 1, 4, 0],        // vi -> IV, ii, V, I
  6: [0, 2],              // vii -> I, iii
};

/**
 * Common chord movements in minor keys.
 * Maps degree index (0=i, 1=ii, ..., 6=VII) to arrays of likely next degrees.
 */
const MINOR_MOVEMENTS: Record<number, number[]> = {
  0: [3, 5, 6, 4],        // i   -> iv, VI, VII, v
  1: [4, 0],               // ii  -> v, i
  2: [5, 3, 6],            // III -> VI, iv, VII
  3: [6, 0, 4],            // iv  -> VII, i, v
  4: [0, 5],               // v   -> i, VI
  5: [3, 6, 2, 0],         // VI  -> iv, VII, III, i
  6: [0, 5, 2],            // VII -> i, VI, III
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Find all keys (major and minor) that contain ALL chords in the progression.
 * Returns matching keys sorted by preference (fewer sharps/flats first).
 */
export function findMatchingKeys(chordNames: string[]): MatchingKey[] {
  if (chordNames.length === 0) return [];

  const matches: MatchingKey[] = [];

  for (const [keyName, keyInfo] of Object.entries(KEY_DATA)) {
    const chordDegrees: number[] = [];
    let allFound = true;

    for (const chord of chordNames) {
      const degreeIndex = keyInfo.diatonicChords.indexOf(chord);
      if (degreeIndex === -1) {
        allFound = false;
        break;
      }
      chordDegrees.push(degreeIndex);
    }

    if (allFound) {
      matches.push({
        key: keyName,
        mode: isMajorKey(keyName) ? 'Major' : 'Minor',
        chordDegrees,
      });
    }
  }

  // Sort: prefer keys with fewer sharps/flats, then major before minor
  matches.sort((a, b) => {
    const aInfo = KEY_DATA[a.key];
    const bInfo = KEY_DATA[b.key];
    const aAccidentals = aInfo.sharps + aInfo.flats;
    const bAccidentals = bInfo.sharps + bInfo.flats;
    if (aAccidentals !== bAccidentals) return aAccidentals - bAccidentals;
    // Prefer major keys
    if (a.mode !== b.mode) return a.mode === 'Major' ? -1 : 1;
    return 0;
  });

  return matches;
}

/**
 * Get suggested next chords based on the current progression and matching keys.
 */
export function getSuggestedChords(
  chordNames: string[],
  matchingKeys: MatchingKey[],
): ChordSuggestions {
  const result: ChordSuggestions = {
    strongMoves: [],
    inKey: [],
    colorChords: [],
  };

  if (matchingKeys.length === 0 || chordNames.length === 0) return result;

  const primaryKey = matchingKeys[0];
  const keyInfo = KEY_DATA[primaryKey.key];
  const lastChordDegree = primaryKey.chordDegrees[primaryKey.chordDegrees.length - 1];
  const movements = primaryKey.mode === 'Major' ? MAJOR_MOVEMENTS : MINOR_MOVEMENTS;
  const strongDegrees = movements[lastChordDegree] ?? [];

  const addedChords = new Set<string>();

  // Strong moves: common next chords based on functional harmony
  for (const degree of strongDegrees) {
    const chordName = keyInfo.diatonicChords[degree];
    if (addedChords.has(chordName)) continue;
    addedChords.add(chordName);
    result.strongMoves.push({
      name: chordName,
      numeral: keyInfo.chordQualities[degree],
      degreeIndex: degree,
      fromKey: primaryKey.key,
    });
  }

  // In key: remaining diatonic chords not in strongMoves
  for (let degree = 0; degree < 7; degree++) {
    const chordName = keyInfo.diatonicChords[degree];
    if (addedChords.has(chordName)) continue;
    addedChords.add(chordName);
    result.inKey.push({
      name: chordName,
      numeral: keyInfo.chordQualities[degree],
      degreeIndex: degree,
      fromKey: primaryKey.key,
    });
  }

  // Color chords: secondary dominants
  // The dominant (major chord) of each diatonic chord target
  const colorTargets = primaryKey.mode === 'Major'
    ? [1, 2, 3, 5]   // V/ii, V/iii, V/IV, V/vi
    : [2, 3, 5, 6];  // V/III, V/iv, V/VI, V/VII

  for (const targetDegree of colorTargets) {
    const targetRoot = keyInfo.scaleNotes[targetDegree];
    const targetRootIndex = getNoteIndex(targetRoot);
    if (targetRootIndex === -1) continue;

    // The secondary dominant is a major chord whose root is a P5 above the target
    // i.e., the root is 7 semitones below the target (or 5 above)
    const secDomRoot = getNoteName((targetRootIndex + 7) % 12);
    const secDomName = secDomRoot; // Major chord = just the root name

    if (addedChords.has(secDomName)) continue;
    // Don't suggest if it's already a diatonic chord
    if (keyInfo.diatonicChords.includes(secDomName)) continue;
    addedChords.add(secDomName);

    result.colorChords.push({
      name: secDomName,
      numeral: `V/${keyInfo.chordQualities[targetDegree]}`,
      degreeIndex: -1,
      fromKey: primaryKey.key,
    });
  }

  // Borrowed chords from parallel major/minor
  const parallelKeyName = primaryKey.mode === 'Major'
    ? keyInfo.relativeMinor
      ? KEY_DATA[keyInfo.relativeMinor]?.relativeMajor === primaryKey.key
        // For parallel minor, find the minor key with the same root
        ? findParallelKey(primaryKey.key, 'Minor')
        : null
      : null
    : findParallelKey(primaryKey.key, 'Major');

  if (parallelKeyName) {
    const parallelInfo = KEY_DATA[parallelKeyName];
    if (parallelInfo) {
      for (const chord of parallelInfo.diatonicChords) {
        if (addedChords.has(chord)) continue;
        if (keyInfo.diatonicChords.includes(chord)) continue;
        addedChords.add(chord);
        result.colorChords.push({
          name: chord,
          numeral: `borrowed`,
          degreeIndex: -1,
          fromKey: parallelKeyName,
        });
      }
    }
  }

  return result;
}

/**
 * Get all starter chord suggestions (when progression is empty).
 * Returns common chord roots with Major and Minor qualities.
 */
export function getStarterChords(): { root: string; types: { name: string; quality: string }[] }[] {
  const commonRoots = ['C', 'G', 'D', 'A', 'E', 'F', 'B', 'Bb', 'Eb', 'Ab', 'Db', 'F#'];
  return commonRoots.map(root => {
    const types: { name: string; quality: string }[] = [
      { name: root, quality: 'Major' },
      { name: root + 'm', quality: 'Minor' },
    ];
    return { root, types };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the parallel major or minor key for a given key name. */
function findParallelKey(keyName: string, targetMode: 'Major' | 'Minor'): string | null {
  // Extract the root from the key name (e.g., "Am" -> "A", "C" -> "C")
  const root = isMajorKey(keyName) ? keyName : keyName.replace('m', '');

  if (targetMode === 'Minor') {
    const minorName = root + 'm';
    return KEY_DATA[minorName] ? minorName : null;
  } else {
    return KEY_DATA[root] ? root : null;
  }
}
