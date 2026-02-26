"use client";

import dynamic from "next/dynamic";

const AlphaTexStatic = dynamic(() => import("../AlphaTexStatic"), { ssr: false });

// AlphaTex: strings 1=high e → 6=low E
// G5  = frets 3,5,5 on E,A,D  → (3.6 5.5 5.4)
// Bb5 = frets 6,8,8 on E,A,D  → (6.6 8.5 8.4)
// Am5 = frets 5,7,7 on E,A,D  → (5.6 7.5 7.4)
// C5  = frets 8,10,10 on E,A,D → (8.6 10.5 10.4)
// F5  = frets 1,3,3 on E,A,D  → (1.6 3.5 3.4)
// G5  = frets 3,5,5 on E,A,D  → (3.6 5.5 5.4)

const EXERCISES = [
  {
    label: "Ex. 1 — i5 → ♭III5 in G Minor",
    description: "The root riff. G5 (i) resolves to B♭5 (♭III), 3 frets higher.",
    alphatex: `\\title "i5 → ♭III5 — Key of G Minor"
\\tempo 90
.:4 (3.6 5.5 5.4) (3.6 5.5 5.4) (6.6 8.5 8.4) (6.6 8.5 8.4) |
(3.6 5.5 5.4) (3.6 5.5 5.4) (6.6 8.5 8.4) (6.6 8.5 8.4) |`,
  },
  {
    label: "Ex. 2 — i5 → ♭III5 in A Minor (Transposed)",
    description: "Exact same riff, shifted up 2 frets. Am5 → C5. Shape is identical.",
    alphatex: `\\title "i5 → ♭III5 — Key of A Minor"
\\tempo 90
.:4 (5.6 7.5 7.4) (5.6 7.5 7.4) (8.6 10.5 10.4) (8.6 10.5 10.4) |
(5.6 7.5 7.4) (5.6 7.5 7.4) (8.6 10.5 10.4) (8.6 10.5 10.4) |`,
  },
  {
    label: "Ex. 3 — i – ♭VI – ♭III – ♭VII in A Minor",
    description: "The full rock progression: Am → F → C → G, two beats each.",
    alphatex: `\\title "i – ♭VI – ♭III – ♭VII — Key of A Minor"
\\tempo 90
.:2 (5.6 7.5 7.4) (1.6 3.5 3.4) |
(8.6 10.5 10.4) (3.6 5.5 5.4) |
(5.6 7.5 7.4) (1.6 3.5 3.4) |
(8.6 10.5 10.4) (3.6 5.5 5.4) |`,
  },
];

export default function TransposingMinorProgressions() {
  return (
    <div className="space-y-10 text-gray-300">

      {/* Intro */}
      <p className="text-gray-400 leading-relaxed">
        The same minor-key chord shapes and riffs can be moved to any key by shifting the entire
        pattern up or down the neck. The Roman numeral names stay the same — only the fret positions change.
      </p>

      {/* Scale Degrees */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          Natural Minor Scale Degrees
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800">
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Degree</th>
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Quality</th>
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Key of Gm</th>
                <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Key of Am</th>
              </tr>
            </thead>
            <tbody>
              {[
                { degree: "i",     quality: "minor",       gm: "Gm",  am: "Am",  color: "text-blue-400" },
                { degree: "ii°",   quality: "diminished",  gm: "A°",  am: "B°",  color: "text-orange-400" },
                { degree: "♭III",  quality: "major",       gm: "B♭",  am: "C",   color: "text-emerald-400" },
                { degree: "iv",    quality: "minor",       gm: "Cm",  am: "Dm",  color: "text-blue-400" },
                { degree: "v",     quality: "minor",       gm: "Dm",  am: "Em",  color: "text-blue-400" },
                { degree: "♭VI",   quality: "major",       gm: "E♭",  am: "F",   color: "text-emerald-400" },
                { degree: "♭VII",  quality: "major",       gm: "F",   am: "G",   color: "text-emerald-400" },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className={`px-4 py-2.5 font-mono font-semibold ${row.color}`}>{row.degree}</td>
                  <td className="px-4 py-2.5 text-gray-400 capitalize">{row.quality}</td>
                  <td className="px-4 py-2.5 text-white font-medium">{row.gm}</td>
                  <td className="px-4 py-2.5 text-white font-medium">{row.am}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500 italic">
          Rock / metal often plays the ii° as a power chord, avoiding the diminished quality entirely.
        </p>
      </section>

      {/* Transposition */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          How Transposition Works
        </h2>
        <ol className="space-y-2 mb-6">
          {[
            "Identify the root note of the tonic chord.",
            "Move every chord / note by the same interval to reach the new tonic.",
            "The shape, rhythm, and picking pattern stay identical.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-gray-300">{step}</span>
            </li>
          ))}
        </ol>

        <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">
            Example — i5 → ♭III5 riff
          </p>
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="pr-8 pb-2 text-left text-gray-400 font-medium">Key</th>
                <th className="pr-8 pb-2 text-left text-gray-400 font-medium">i5 (low E)</th>
                <th className="pb-2 text-left text-gray-400 font-medium">♭III5 (low E)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pr-8 py-1 text-gray-300">Gm</td>
                <td className="pr-8 py-1"><span className="font-mono text-blue-400">fret 3</span> <span className="text-gray-500 text-xs">(G)</span></td>
                <td className="py-1"><span className="font-mono text-emerald-400">fret 6</span> <span className="text-gray-500 text-xs">(B♭)</span></td>
              </tr>
              <tr>
                <td className="pr-8 py-1 text-gray-300">Am</td>
                <td className="pr-8 py-1"><span className="font-mono text-blue-400">fret 5</span> <span className="text-gray-500 text-xs">(A)</span></td>
                <td className="py-1"><span className="font-mono text-emerald-400">fret 8</span> <span className="text-gray-500 text-xs">(C)</span></td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-400">
            i → ♭III is always a <strong className="text-white">minor third (3 frets)</strong>. The same riff starts just 2 frets higher when moving from Gm to Am.
          </p>
        </div>
      </section>

      {/* Exercises */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1 pb-2 border-b border-gray-700">
          Exercises
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Exercises 1 and 2 are the same riff in different keys — compare the tab and notice the shape
          is identical, just shifted up 2 frets.
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

      {/* The i–bVI–bIII–bVII progression */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1 pb-2 border-b border-gray-700">
          The i – ♭VI – ♭III – ♭VII Progression
        </h2>
        <p className="text-gray-400 text-sm mb-5">
          The single most important minor-key progression in rock and metal.
        </p>

        <div className="space-y-3 mb-6">
          {[
            { key: "Am", chords: ["Am", "F", "C", "G"] },
            { key: "Gm", chords: ["Gm", "E♭", "B♭", "F"] },
            { key: "Em", chords: ["Em", "C", "G", "D"] },
          ].map(({ key, chords }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-8 text-right font-mono">{key}</span>
              <div className="flex gap-2">
                {chords.map((chord, i) => (
                  <div
                    key={i}
                    className={`px-3 py-1.5 rounded text-sm font-semibold ${
                      i === 0
                        ? "bg-blue-600/25 text-blue-300 border border-blue-600/40"
                        : "bg-gray-700/60 text-gray-200 border border-gray-600/40"
                    }`}
                  >
                    {chord}
                  </div>
                ))}
              </div>
              <span className="text-xs text-gray-600 font-mono ml-1">
                i – ♭VI – ♭III – ♭VII
              </span>
            </div>
          ))}
        </div>

        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">Why it works</p>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2"><span className="text-blue-500 mt-0.5">▸</span> All four chords are fully diatonic — no outside notes needed.</li>
            <li className="flex gap-2"><span className="text-blue-500 mt-0.5">▸</span> Root motion moves mostly in <strong className="text-white">fourths and fifths</strong>, creating strong forward momentum.</li>
            <li className="flex gap-2"><span className="text-blue-500 mt-0.5">▸</span> The <strong className="text-white">♭VII → i resolution</strong> (e.g. G → Am) defines the "rock sound", distinct from classical leading-tone resolution.</li>
            <li className="flex gap-2"><span className="text-blue-500 mt-0.5">▸</span> The ♭VI and ♭III bring major-key brightness that contrasts against the minor tonic.</li>
          </ul>
        </div>
      </section>

      {/* Practical Application */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          Practical Application
        </h2>
        <ul className="space-y-3 text-sm text-gray-300">
          <li className="flex gap-2">
            <span className="text-emerald-500 mt-0.5">▸</span>
            <span><strong className="text-white">Learn a riff in one key, then immediately transpose it</strong> to at least two more without looking at tab — builds real fluency vs. memorising fret numbers.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500 mt-0.5">▸</span>
            <span>Suggested practice keys: <span className="font-mono text-gray-200">Em · Dm · Bm · F#m</span></span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500 mt-0.5">▸</span>
            <span><strong className="text-white">Power chords simplify transposition</strong> — no third means the same shape works in major or minor contexts.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500 mt-0.5">▸</span>
            <span>Naming Roman numerals while you play lets you communicate with other musicians in any key instantly.</span>
          </li>
        </ul>
      </section>

      {/* Reference Chord Charts */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          Reference Chord Charts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Key of Gm", chords: ["Gm","Am","B♭","Cm","Dm","E♭","F","Gm"] },
            { label: "Key of Am", chords: ["Am","Bm","C","Dm","Em","F","G","Am"] },
          ].map(({ label, chords }) => (
            <div key={label} className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {["i","ii","♭III","iv","v","♭VI","♭VII","i"].map((numeral, i) => (
                  <div key={i} className="text-center">
                    <div className="text-xs text-gray-500 font-mono mb-1">{numeral}</div>
                    <div className="px-2 py-1 bg-gray-700/60 rounded text-xs text-white font-medium min-w-10 text-center">
                      {chords[i]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
