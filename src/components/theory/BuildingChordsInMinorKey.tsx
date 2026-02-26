"use client";

import dynamic from "next/dynamic";

const AlphaTexStatic = dynamic(() => import("../AlphaTexStatic"), { ssr: false });

// AlphaTex string numbering: 1=high e, 2=B, 3=G, 4=D, 5=A, 6=low E
const EXERCISES = [
  {
    label: "Ex. 1 — E Natural Minor Scale (single string)",
    description: "Play ascending and descending on the low E string. Say each scale degree name out loud as you go.",
    alphatex: `\\title "E Natural Minor Scale"
\\tempo 80
.:8 0.6 2.6 3.6 5.6 7.6 8.6 10.6 12.6 |
12.6 10.6 8.6 7.6 5.6 3.6 2.6 0.6 |`,
  },
  {
    label: "Ex. 2 — Harmonized Thirds (Diads) on D/G Strings",
    description: "Two-note chords up the neck. Say the quality aloud: minor, minor, major, minor, minor, major, major, minor.",
    alphatex: `\\title "Harmonized Thirds — E Minor"
\\tempo 70
.:4 (2.4 0.3) (4.4 2.3) (5.4 4.3) (7.4 5.3) |
(9.4 7.3) (10.4 9.3) (12.4 11.3) (14.4 12.3) |`,
  },
  {
    label: "Ex. 3 — Harmonized Triads on D/G/B Strings",
    description: "Three-string voicings for all seven diatonic chords. Name each chord as you play it: Em, F♯dim, G, Am, Bm, C, D.",
    alphatex: `\\title "Harmonized Triads — E Minor"
\\tempo 70
.:2 (2.4 0.3 0.2) (4.4 2.3 1.2) |
(5.4 4.3 3.2) (7.4 5.3 5.2) |
(9.4 7.3 7.2) (10.4 9.3 8.2) |
(12.4 11.3 10.2) (14.4 12.3 12.2) |`,
  },
  {
    label: "Ex. 4 — i – ♭VI – ♭III – ♭VII in E Minor",
    description: "The defining minor-key rock progression using power chords: Em – C – G – D. Two beats each.",
    alphatex: `\\title "i – ♭VI – ♭III – ♭VII — E Minor"
\\tempo 90
.:2 (0.6 2.5 2.4) (3.5 5.4 5.3) |
(3.6 5.5 5.4) (5.5 7.4 7.3) |
(0.6 2.5 2.4) (3.5 5.4 5.3) |
(3.6 5.5 5.4) (5.5 7.4 7.3) |`,
  },
];

export default function BuildingChordsInMinorKey() {
  return (
    <div className="space-y-10 text-gray-300">

      <p className="text-gray-400 leading-relaxed">
        How every chord in a minor key is constructed from the ground up:
        scale degrees, harmonized thirds (diads), triads, and full barre-chord voicings.
      </p>

      {/* 1. The E Natural Minor Scale */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          1. The E Natural Minor Scale
        </h2>

        <p className="text-sm text-gray-400 mb-4">
          Played on the low E string so every interval is laid out in a straight line:
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800">
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Fret</th>
                {[0,2,3,5,7,8,10,12].map(f => (
                  <th key={f} className="px-3 py-2 text-center text-gray-400 font-medium font-mono">{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="px-3 py-2 text-gray-400 font-medium">Note</td>
                {["E","F♯","G","A","B","C","D","E"].map((n,i) => (
                  <td key={i} className="px-3 py-2 text-center text-white font-semibold">{n}</td>
                ))}
              </tr>
              <tr>
                <td className="px-3 py-2 text-gray-400 font-medium">Degree</td>
                {["1","2","♭3","4","5","♭6","♭7","8/1"].map((d,i) => (
                  <td key={i} className={`px-3 py-2 text-center font-mono font-semibold ${
                    ["♭3","♭6","♭7"].includes(d) ? "text-orange-400" : "text-blue-400"
                  }`}>{d}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-sm text-gray-400 mb-3">
          Natural minor = major scale with three notes lowered one fret (one half step):
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800">
                <th className="px-4 py-2 text-left text-gray-400 font-medium">Degree</th>
                <th className="px-4 py-2 text-left text-gray-400 font-medium">E Major</th>
                <th className="px-4 py-2 text-left text-gray-400 font-medium">E Natural Minor</th>
                <th className="px-4 py-2 text-left text-gray-400 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {[
                { deg: "1",  maj: "E",  min: "E",  changed: false },
                { deg: "2",  maj: "F♯", min: "F♯", changed: false },
                { deg: "3",  maj: "G♯", min: "G",  changed: true  },
                { deg: "4",  maj: "A",  min: "A",  changed: false },
                { deg: "5",  maj: "B",  min: "B",  changed: false },
                { deg: "6",  maj: "C♯", min: "C",  changed: true  },
                { deg: "7",  maj: "D♯", min: "D",  changed: true  },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-2 font-mono text-gray-400">{row.deg}</td>
                  <td className="px-4 py-2 text-white font-medium">{row.maj}</td>
                  <td className={`px-4 py-2 font-semibold ${row.changed ? "text-orange-400" : "text-white"}`}>
                    {row.min}
                  </td>
                  <td className={`px-4 py-2 text-sm ${row.changed ? "text-orange-400" : "text-gray-600"}`}>
                    {row.changed ? "lowered 1 fret" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          The ♭3 is the most important — it&apos;s the single note that makes anything sound minor. The ♭6 and ♭7 reinforce the darker character.
          Step pattern: <span className="font-mono text-gray-400">W – H – W – W – H – W – W</span>
        </p>
      </section>

      {/* 2. What Harmonizing Means */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          2. What "Harmonizing a Scale" Means
        </h2>
        <p className="text-sm text-gray-400 mb-4 leading-relaxed">
          Harmonizing a scale means building a chord on every note of the scale using <em>only</em> notes
          that belong to that scale — no outside notes allowed. Think of the scale as your alphabet;
          harmonizing is spelling words using only those letters.
        </p>
        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">Why we stack thirds</p>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="text-orange-500 mt-0.5">▸</span>
              <span><strong className="text-white">Seconds</strong> (adjacent notes) — crunchy and dissonant when stacked</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500 mt-0.5">▸</span>
              <span><strong className="text-white">Thirds</strong> — the sweet spot: enough color to hear major vs. minor, still consonant</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-500 mt-0.5">▸</span>
              <span><strong className="text-white">Fourths / Fifths</strong> — hollow and open (power chords — no major/minor quality)</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Process: start on a scale degree, skip the next note, land on the one after. That interval is a third.
          </p>
        </div>
      </section>

      {/* 3. Harmonized Thirds — Diads */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          3. Harmonized Thirds — Diads (Two-Note Chords)
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          A diad is a root + third. Two notes are enough to tell you whether a chord is major or minor.
          These run across the G string (3rd) and B string (2nd).
        </p>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800">
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Degree</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Root (B str)</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Third (G str)</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Fret area</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Quality</th>
              </tr>
            </thead>
            <tbody>
              {[
                { deg: "1",   root: "E",  third: "G",  fret: "~3",  q: "Minor" },
                { deg: "2",   root: "F♯", third: "A",  fret: "~5",  q: "Minor" },
                { deg: "♭3",  root: "G",  third: "B",  fret: "~7",  q: "Major" },
                { deg: "4",   root: "A",  third: "C",  fret: "~9",  q: "Minor" },
                { deg: "5",   root: "B",  third: "D",  fret: "~12", q: "Minor" },
                { deg: "♭6",  root: "C",  third: "E",  fret: "~13", q: "Major" },
                { deg: "♭7",  root: "D",  third: "F♯", fret: "~15", q: "Major" },
                { deg: "8/1", root: "E",  third: "G",  fret: "~15", q: "Minor" },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-3 py-2 font-mono text-gray-400">{row.deg}</td>
                  <td className="px-3 py-2 text-white font-medium">{row.root}</td>
                  <td className="px-3 py-2 text-white font-medium">{row.third}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{row.fret}</td>
                  <td className={`px-3 py-2 font-semibold ${row.q === "Major" ? "text-emerald-400" : "text-blue-400"}`}>
                    {row.q}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Why the qualities alternate that way</p>
          <p className="text-sm text-gray-400 mb-3">
            Each third is major (4 frets) or minor (3 frets). The scale&apos;s own uneven spacing dictates it — you&apos;re not choosing:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {[
              { pair: "E → G",  frets: "0 to 3",  count: "3 frets", q: "minor", color: "text-blue-400" },
              { pair: "F♯ → A", frets: "2 to 5",  count: "3 frets", q: "minor", color: "text-blue-400" },
              { pair: "G → B",  frets: "3 to 7",  count: "4 frets", q: "major", color: "text-emerald-400" },
              { pair: "A → C",  frets: "5 to 8",  count: "3 frets", q: "minor", color: "text-blue-400" },
            ].map((ex, i) => (
              <div key={i} className="bg-gray-800 rounded px-3 py-2">
                <span className="text-gray-300">{ex.pair}</span>
                <span className="text-gray-600 mx-2">({ex.count})</span>
                <span className={`font-semibold ${ex.color}`}>= {ex.q}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Using diads musically</p>
          <ul className="space-y-1.5 text-sm text-gray-300">
            {[
              "Rhythm parts in a band mix — two notes cut through distortion without muddiness",
              "Double stops in solos and riffs — blues and rock players use these constantly",
              "Voice leading — moving smoothly from one diad to the next on the same two strings",
              "Ear training — if you can hear major vs. minor thirds, you can figure out any chord",
            ].map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-500 mt-0.5 shrink-0">▸</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Harmonized Triads */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          4. Harmonized Triads (Three-Note Chords)
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Add one more third on top of the diad: root + third + fifth. Played on the G, B, and high-e strings.
        </p>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800">
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Degree</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Root</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Third</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Fifth</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Chord</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Quality</th>
              </tr>
            </thead>
            <tbody>
              {[
                { deg: "i",    root: "E",  third: "G",  fifth: "B",  chord: "Em",    q: "minor",      qColor: "text-blue-400" },
                { deg: "ii°",  root: "F♯", third: "A",  fifth: "C",  chord: "F♯dim", q: "diminished", qColor: "text-orange-400" },
                { deg: "♭III", root: "G",  third: "B",  fifth: "D",  chord: "G",     q: "major",      qColor: "text-emerald-400" },
                { deg: "iv",   root: "A",  third: "C",  fifth: "E",  chord: "Am",    q: "minor",      qColor: "text-blue-400" },
                { deg: "v",    root: "B",  third: "D",  fifth: "F♯", chord: "Bm",    q: "minor",      qColor: "text-blue-400" },
                { deg: "♭VI",  root: "C",  third: "E",  fifth: "G",  chord: "C",     q: "major",      qColor: "text-emerald-400" },
                { deg: "♭VII", root: "D",  third: "F♯", fifth: "A",  chord: "D",     q: "major",      qColor: "text-emerald-400" },
                { deg: "i",    root: "E",  third: "G",  fifth: "B",  chord: "Em",    q: "minor",      qColor: "text-blue-400" },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-3 py-2 font-mono font-semibold text-gray-300">{row.deg}</td>
                  <td className="px-3 py-2 text-white font-medium">{row.root}</td>
                  <td className="px-3 py-2 text-white font-medium">{row.third}</td>
                  <td className="px-3 py-2 text-white font-medium">{row.fifth}</td>
                  <td className="px-3 py-2 text-white font-bold">{row.chord}</td>
                  <td className={`px-3 py-2 font-semibold capitalize ${row.qColor}`}>{row.q}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Why the ii chord is diminished</p>
          <p className="text-sm text-gray-400">
            F♯ to A = minor third (3 frets), then A to C = minor third (3 frets). Two stacked minor thirds
            produce a diminished triad. The root-to-fifth distance (F♯ → C) is a <strong className="text-white">tritone — 6 frets</strong>,
            one fret narrower than a perfect fifth. That compressed fifth is what makes diminished chords sound tense and unstable.
          </p>
        </div>
      </section>

      {/* 5. The Seven Diatonic Chords */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          5. The Seven Diatonic Chords of E Minor
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Full barre-chord voicings across the four highest strings.
          The ii° is altered to F♯m — this is standard practice in pop, rock, and folk.
        </p>

        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800">
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Degree</th>
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Chord</th>
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Quality</th>
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {[
                { deg: "i",    chord: "Em",   q: "minor",   role: "Tonic — home base",                          qColor: "text-blue-400" },
                { deg: "ii",   chord: "F♯m*", q: "minor*",  role: "Altered from dim° — see note below",         qColor: "text-blue-400" },
                { deg: "♭III", chord: "G",    q: "major",   role: "Relative major — bright contrast",           qColor: "text-emerald-400" },
                { deg: "iv",   chord: "Am",   q: "minor",   role: "Subdominant — pulls toward home",            qColor: "text-blue-400" },
                { deg: "v",    chord: "Bm",   q: "minor",   role: "Dominant — weaker pull than major key's V",  qColor: "text-blue-400" },
                { deg: "♭VI",  chord: "C",    q: "major",   role: "Emotional weight — \"epic\" sound",          qColor: "text-emerald-400" },
                { deg: "♭VII", chord: "D",    q: "major",   role: "Pre-tonic — rock's way to resolve to i",    qColor: "text-emerald-400" },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono font-semibold text-gray-300">{row.deg}</td>
                  <td className="px-4 py-2.5 text-white font-bold">{row.chord}</td>
                  <td className={`px-4 py-2.5 font-semibold capitalize ${row.qColor}`}>{row.q}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 italic mb-5">
          * F♯dim is altered to F♯m because diminished barre chords are virtually never used in rock/pop/folk.
          The change: C (flat fifth) becomes C♯ (perfect fifth) — technically borrowed from outside the key, but sounds natural.
        </p>

        {/* Memory shortcut tip */}
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Memory Shortcut</p>
          <p className="text-sm text-white">
            In a minor key, <span className="text-blue-400 font-semibold">minor chords</span> fall on{" "}
            <span className="font-mono text-blue-300">i, (ii), iv, v</span>. The{" "}
            <span className="text-emerald-400 font-semibold">major chords</span> fall on{" "}
            <span className="font-mono text-emerald-300">♭III, ♭VI, ♭VII</span>.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Once you know this pattern you can name the chord quality for every degree in any minor key instantly.
          </p>
        </div>
      </section>

      {/* 6. Relative Major and Minor */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          6. Relative Major and Minor
        </h2>
        <p className="text-sm text-gray-400 mb-4 leading-relaxed">
          Every minor key shares all its notes with exactly one major key — same seven pitches, same seven
          chords, just numbered from a different starting point. The natural minor scale is hidden inside
          every major scale: start on the <strong className="text-white">6th degree</strong> and play up an octave.
        </p>

        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50 mb-5 font-mono text-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-sans font-semibold">Example: E major ↔ C♯ minor</p>
          <div className="space-y-1 text-xs">
            <div className="flex gap-2 items-baseline">
              <span className="text-gray-500 w-32 shrink-0">E major scale:</span>
              <span className="text-white">E &nbsp;F♯ &nbsp;G♯ &nbsp;A &nbsp;B &nbsp;C♯ &nbsp;D♯ &nbsp;E</span>
            </div>
            <div className="flex gap-2 items-baseline">
              <span className="text-gray-500 w-32 shrink-0">Degrees:</span>
              <span className="text-gray-400">1 &nbsp;&nbsp;2 &nbsp;&nbsp;3 &nbsp;&nbsp;4 &nbsp;5 &nbsp;&nbsp;6 &nbsp;&nbsp;7 &nbsp;&nbsp;8</span>
            </div>
            <div className="flex gap-2 items-baseline mt-2">
              <span className="text-gray-500 w-32 shrink-0">C♯ natural minor:</span>
              <span className="text-emerald-300">C♯ &nbsp;D♯ &nbsp;E &nbsp;F♯ &nbsp;G♯ &nbsp;A &nbsp;B &nbsp;C♯</span>
            </div>
            <div className="flex gap-2 items-baseline">
              <span className="text-gray-500 w-32 shrink-0">Degrees:</span>
              <span className="text-gray-400">1 &nbsp;&nbsp;2 &nbsp;♭3 &nbsp;4 &nbsp;&nbsp;5 &nbsp;&nbsp;♭6 &nbsp;♭7 &nbsp;8</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 font-sans">Same seven notes. Different home base.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Find the relative minor</p>
            <p className="text-sm text-gray-300">Go to the <span className="text-white font-semibold">6th degree</span> of the major key.</p>
            <p className="text-xs text-gray-500 mt-1 font-mono">E major → 6th = C♯ → C♯ minor</p>
          </div>
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Find the relative major</p>
            <p className="text-sm text-gray-300">Go to the <span className="text-white font-semibold">♭III degree</span> of the minor key.</p>
            <p className="text-xs text-gray-500 mt-1 font-mono">E minor → ♭III = G → G major</p>
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">Why this matters on guitar</p>
          <ul className="space-y-2 text-sm text-gray-300">
            {[
              "Every scale pattern does double duty — E minor pentatonic is also G major pentatonic. Same frets, different emphasis.",
              "Progressions work from either perspective: Am–F–C–G is i–♭VI–♭III–♭VII in A minor OR vi–IV–I–V in C major. Both are correct.",
              "If you're comfortable in G major, you already know E minor — just reorient your ear toward E as home.",
            ].map((point, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">▸</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7. Construction Summary */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          7. Putting It All Together
        </h2>

        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700 mb-6 font-mono text-xs overflow-x-auto">
          <p className="text-gray-500 mb-3 font-sans text-xs uppercase tracking-wider font-semibold">Layer by layer — how each builds on the last</p>
          <table className="text-xs border-collapse w-full">
            <tbody>
              <tr>
                <td className="pr-4 py-1 text-gray-500 whitespace-nowrap">Scale notes</td>
                {["E","F♯","G","A","B","C","D","E"].map((n,i) => (
                  <td key={i} className="px-2 py-1 text-center text-white font-bold">{n}</td>
                ))}
              </tr>
              <tr>
                <td className="pr-4 py-1 text-gray-500 whitespace-nowrap">Diads (3rds)</td>
                {["E-G","F♯-A","G-B","A-C","B-D","C-E","D-F♯","E-G"].map((d,i) => (
                  <td key={i} className="px-2 py-1 text-center text-gray-300">{d}</td>
                ))}
              </tr>
              <tr>
                <td className="pr-4 py-1 text-gray-500 whitespace-nowrap">Quality</td>
                {["min","min","Maj","min","min","Maj","Maj","min"].map((q,i) => (
                  <td key={i} className={`px-2 py-1 text-center font-semibold ${q === "Maj" ? "text-emerald-400" : "text-blue-400"}`}>{q}</td>
                ))}
              </tr>
              <tr>
                <td className="pr-4 py-1 text-gray-500 whitespace-nowrap">Triads</td>
                {["Em","F♯°","G","Am","Bm","C","D","Em"].map((c,i) => (
                  <td key={i} className="px-2 py-1 text-center text-white font-bold">{c}</td>
                ))}
              </tr>
              <tr>
                <td className="pr-4 py-1 text-gray-500 whitespace-nowrap">Degrees</td>
                {["i","ii°","♭III","iv","v","♭VI","♭VII","i"].map((d,i) => (
                  <td key={i} className="px-2 py-1 text-center text-gray-400">{d}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Practice suggestions</p>
          {[
            { n: 1, text: "Play the diads up and down the G/B strings while saying \"minor, minor, major\" out loud. Train your ear to hear the difference between the third types." },
            { n: 2, text: "Play the triads on the G/B/e strings while naming each chord aloud: \"E minor, F-sharp diminished, G major…\" — connects chord names to sounds and fretboard positions simultaneously." },
            { n: 3, text: "Pick any two chords from the harmonized scale and play them back-to-back. Notice which combinations sound resolved (like an ending) and which want to keep moving." },
            { n: 4, text: "Compare the harmonized E minor triads to G major triads (same notes, different start). The chord sequence is identical — only the Roman numerals change." },
            { n: 5, text: "Connect to the i–♭VI–♭III–♭VII progression: those four chords are the 1st, 6th, 3rd, and 7th of the harmonized scale. In E minor: Em–C–G–D." },
          ].map(({ n, text }) => (
            <div key={n} className="flex gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">
                {n}
              </span>
              <span className="text-sm text-gray-300">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Exercises */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1 pb-2 border-b border-gray-700">
          Exercises
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Work through these in order — each one adds a layer on top of the previous.
        </p>
        <div className="space-y-8">
          {EXERCISES.map((ex) => (
            <div key={ex.label}>
              <div className="mb-2">
                <p className="text-sm font-semibold text-white">{ex.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{ex.description}</p>
              </div>
              <AlphaTexStatic alphatex={ex.alphatex} />
            </div>
          ))}
        </div>
      </section>

      {/* Quick Reference */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          Quick Reference
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Minor scale formula</p>
            <p className="text-sm text-white font-mono">major + ♭3, ♭6, ♭7</p>
            <p className="text-xs text-gray-500 mt-1 font-mono">W–H–W–W–H–W–W</p>
          </div>
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Chord qualities</p>
            <p className="text-sm"><span className="text-blue-400">Minor:</span> <span className="font-mono text-gray-300">i, (ii), iv, v</span></p>
            <p className="text-sm"><span className="text-emerald-400">Major:</span> <span className="font-mono text-gray-300">♭III, ♭VI, ♭VII</span></p>
          </div>
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Relative keys</p>
            <p className="text-sm text-gray-300">Minor → Major: <span className="font-mono text-white">↑ ♭III</span></p>
            <p className="text-sm text-gray-300">Major → Minor: <span className="font-mono text-white">↓ to 6th</span></p>
          </div>
        </div>
      </section>

    </div>
  );
}
