import AlphaTexStatic from "../AlphaTexStatic";

export default function WritingAMetalSong() {
  return (
    <div className="space-y-12">
      {/* Intro */}
      <section>
        <p className="text-neutral-300 text-lg leading-relaxed">
          This tutorial walks you through the building blocks of a metal riff, one
          concept at a time. Each step introduces a single idea with a playable tab
          example. By the end, you&apos;ll have everything you need to write your own
          metal song.
        </p>
      </section>

      {/* Step 1: The Power Chord */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Step 1: The Power Chord</h2>
        <p className="text-neutral-300 mb-3">
          Every metal riff starts here. A power chord is just two notes: the{" "}
          <strong className="text-white">root</strong> and the{" "}
          <strong className="text-white">fifth</strong>. There&apos;s no major or minor
          third, which means it sounds neither happy nor sad — just raw and heavy.
          Under distortion, that ambiguity is exactly what you want.
        </p>
        <p className="text-neutral-300 mb-4">
          The shape is simple: index finger on the root (low E string), ring finger two
          frets up on the A string. Move it anywhere on the neck and you get a different
          power chord.
        </p>
        <AlphaTexStatic
          alphatex={`\\title "Power Chord Shapes"
\\tempo 100
\\instrument 29
.
:2 (0.6 2.5) (3.6 5.5) | (5.6 7.5) (7.6 9.5) |
:1 (0.6 2.5)`}
        />
        <p className="text-neutral-400 text-sm mt-2">
          E5 → G5 → A5 → B5 → back to E5. Same shape, different frets.
        </p>
      </section>

      {/* Step 2: Palm Muting */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Step 2: Palm Muting — Making It Chug</h2>
        <p className="text-neutral-300 mb-3">
          A power chord by itself rings out clean. To get the percussive, chunky{" "}
          <strong className="text-white">&quot;chug&quot;</strong> that defines metal
          rhythm guitar, rest the edge of your picking hand lightly on the strings near
          the bridge. This dampens the sound and adds attack. The closer to the bridge,
          the tighter the mute.
        </p>
        <p className="text-neutral-300 mb-4">
          Here&apos;s the same E5 power chord, but now as palm-muted eighth notes.
          Keep your picking hand steady and alternate pick (down-up-down-up).
        </p>
        <AlphaTexStatic
          alphatex={`\\title "The Basic Chug"
\\tempo 120
\\instrument 29
.
:8 (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) |
(0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) :4 (0.6 2.5) r`}
        />
        <p className="text-neutral-400 text-sm mt-2">
          This is the foundation of every metal rhythm part. Master this before moving on.
        </p>
      </section>

      {/* Step 3: First Progression */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Step 3: Your First Progression — i bVI bVII i</h2>
        <p className="text-neutral-300 mb-3">
          Metal lives in <strong className="text-white">minor keys</strong>. The most
          common metal progression is{" "}
          <strong className="text-white">i – bVI – bVII – i</strong>. In the key of E
          minor, that&apos;s <strong className="text-white">Em – C – D – Em</strong>.
        </p>
        <p className="text-neutral-300 mb-3">
          The bVI (a minor sixth above the root) and bVII (a minor seventh) create a
          strong gravitational pull back to the i chord. It sounds inevitable and heavy.
          You&apos;ve heard this in everything from Black Sabbath to Metallica.
        </p>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-800">
                <th className="text-left text-neutral-400 font-medium px-3 py-2 border-b border-neutral-700">Degree</th>
                <th className="text-left text-white font-medium px-3 py-2 border-b border-neutral-700">E minor</th>
                <th className="text-left text-white font-medium px-3 py-2 border-b border-neutral-700">A minor</th>
                <th className="text-left text-white font-medium px-3 py-2 border-b border-neutral-700">D minor</th>
              </tr>
            </thead>
            <tbody className="text-neutral-300">
              <tr><td className="px-3 py-1.5 text-neutral-400">i</td><td className="px-3 py-1.5">E5</td><td className="px-3 py-1.5">A5</td><td className="px-3 py-1.5">D5</td></tr>
              <tr className="bg-neutral-800/50"><td className="px-3 py-1.5 text-neutral-400">bVI</td><td className="px-3 py-1.5">C5</td><td className="px-3 py-1.5">F5</td><td className="px-3 py-1.5">Bb5</td></tr>
              <tr><td className="px-3 py-1.5 text-neutral-400">bVII</td><td className="px-3 py-1.5">D5</td><td className="px-3 py-1.5">G5</td><td className="px-3 py-1.5">C5</td></tr>
            </tbody>
          </table>
        </div>

        <p className="text-neutral-300 mb-4">
          Now combine what you learned in Steps 1 and 2 — play the progression with
          palm-muted power chords:
        </p>
        <AlphaTexStatic
          alphatex={`\\title "i - bVI - bVII - i"
\\tempo 130
\\instrument 29
.
:8 (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) |
(8.6{pm} 10.5{pm}) (8.6{pm} 10.5{pm}) (8.6{pm} 10.5{pm}) (8.6{pm} 10.5{pm}) (10.6{pm} 12.5{pm}) (10.6{pm} 12.5{pm}) (10.6{pm} 12.5{pm}) (10.6{pm} 12.5{pm}) |
:8 (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) (0.6{pm} 2.5{pm}) :2 (0.6 2.5)`}
        />
        <p className="text-neutral-400 text-sm mt-2">
          E5 chugging → C5 → D5 → back to E5 ringing out. You now have a riff.
        </p>
      </section>

      {/* Step 4: The Gallop */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Step 4: Adding Rhythm — The Gallop</h2>
        <p className="text-neutral-300 mb-3">
          Straight eighth notes work, but metal gets its energy from{" "}
          <strong className="text-white">rhythmic variation</strong>. The gallop rhythm
          is an eighth note followed by two sixteenth notes — it creates a charging,
          horse-like feel made famous by Iron Maiden.
        </p>
        <p className="text-neutral-300 mb-4">
          The picking pattern is: <strong className="text-white">down, down-up</strong>{" "}
          in quick succession. Keep your picking hand loose. Here&apos;s the gallop
          applied to single notes first, then to power chords:
        </p>
        <AlphaTexStatic
          alphatex={`\\title "Gallop Rhythm"
\\tempo 150
\\instrument 29
.
:8 0.6{pm} :16 0.6{pm} 0.6{pm} :8 0.6{pm} :16 0.6{pm} 0.6{pm} :8 0.6{pm} :16 0.6{pm} 0.6{pm} :8 0.6{pm} :16 0.6{pm} 0.6{pm} |
:8 0.6{pm} :16 0.6{pm} 0.6{pm} :8 0.6{pm} :16 0.6{pm} 0.6{pm} :8 3.6{pm} :16 3.6{pm} 3.6{pm} :8 3.6{pm} :16 3.6{pm} 3.6{pm} |
:8 (0.6 2.5) :16 (0.6 2.5) (0.6 2.5) :8 (0.6 2.5) :16 (0.6 2.5) (0.6 2.5) :8 (0.6 2.5) :16 (0.6 2.5) (0.6 2.5) :8 (0.6 2.5) :16 (0.6 2.5) (0.6 2.5)`}
        />
        <p className="text-neutral-400 text-sm mt-2">
          Bar 1-2: single-note gallop. Bar 3: gallop on power chords. Same rhythm, bigger sound.
        </p>
      </section>

      {/* Step 5: Drop Tuning */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Step 5: Drop Tuning — Going Lower</h2>
        <p className="text-neutral-300 mb-3">
          Tune your low E string down one whole step to D. This is{" "}
          <strong className="text-white">Drop D</strong> tuning (D-A-D-G-B-E). Two
          things happen: you get a deeper, heavier low note, and power chords on the
          bottom two strings become a single-finger barre — just lay your index finger
          flat across the same fret on strings 6 and 5.
        </p>
        <p className="text-neutral-300 mb-4">
          Here&apos;s the same i-bVI-bVII-i progression from Step 3, but now in Drop D.
          Notice how much easier the chord shapes are:
        </p>
        <AlphaTexStatic
          alphatex={`\\title "Drop D Power Chords"
\\tempo 140
\\tuning D2 A2 D3 G3 B3 E4
\\instrument 29
.
:8 (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) |
(10.6 10.5) (10.6 10.5) (10.6 10.5) (10.6 10.5) (12.6 12.5) (12.6 12.5) (12.6 12.5) (12.6 12.5) |
(0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) (0.6{pm} 0.5{pm}) :4 (0.6 0.5) r`}
        />
        <p className="text-neutral-400 text-sm mt-2">
          Same fret on both strings = power chord. Slide anywhere on the neck.
          Most modern metal uses some form of drop tuning.
        </p>
      </section>

      {/* Step 6: Phrygian Riff */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Step 6: Single-Note Riffs — The Phrygian Sound</h2>
        <p className="text-neutral-300 mb-3">
          Power chord riffs are the backbone, but single-note riffs add melody and
          character. The <strong className="text-white">Phrygian mode</strong> is the
          darkest common scale in metal. Its formula:
        </p>
        <p className="text-neutral-300 font-mono text-sm mb-3 bg-neutral-800 rounded px-3 py-2 inline-block">
          1 – b2 – b3 – 4 – 5 – b6 – b7
        </p>
        <p className="text-neutral-300 mb-3">
          The key ingredient is the <strong className="text-white">b2</strong> — just one
          fret above the root. That half-step tension is what makes Phrygian sound
          menacing. It&apos;s the go-to for death metal, doom, and djent.
        </p>
        <p className="text-neutral-300 mb-3">
          A powerful technique here is the <strong className="text-white">pedal tone</strong>:
          keep returning to the open low string (your root) while moving other notes
          around it. The open string anchors the riff while the melody creates tension.
        </p>
        <AlphaTexStatic
          alphatex={`\\title "Phrygian Pedal Riff"
\\tempo 130
\\instrument 29
.
:8 0.6{pm} 0.6{pm} 1.6 0.6{pm} 3.6 0.6{pm} 1.6 0.6{pm} |
0.6{pm} 0.6{pm} 1.6 3.6 :4 1.6 0.6 |
:8 0.6{pm} 0.6{pm} 1.6 0.6{pm} 3.6 0.6{pm} 1.6 3.6 |
:2 1.6{pm} 0.6`}
        />
        <p className="text-neutral-400 text-sm mt-2">
          The open E (root) is the pedal. Fret 1 (F) is the b2 — that&apos;s where the darkness comes from.
          Fret 3 (G) is the b3.
        </p>
      </section>

      {/* Step 7: Scales for Soloing */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Step 7: Scales for Soloing</h2>
        <p className="text-neutral-300 mb-4">
          When it&apos;s time to play lead, you need to know which notes to reach for.
          Here are the three essential metal scales:
        </p>

        <div className="space-y-3 mb-6">
          <div className="bg-neutral-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white">Minor Pentatonic</h3>
            <p className="text-neutral-500 text-sm font-mono mt-1">1 – b3 – 4 – 5 – b7</p>
            <p className="text-neutral-300 mt-2 text-sm">
              Five notes, zero bad choices. Your safety net for soloing — it works over
              any minor key progression. Start here when improvising.
            </p>
          </div>

          <div className="bg-neutral-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white">Natural Minor (Aeolian)</h3>
            <p className="text-neutral-500 text-sm font-mono mt-1">1 – 2 – b3 – 4 – 5 – b6 – b7</p>
            <p className="text-neutral-300 mt-2 text-sm">
              The pentatonic plus two extra notes (2 and b6). More melodic options, still
              safe over minor progressions. The bread and butter of thrash metal leads.
            </p>
          </div>

          <div className="bg-neutral-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white">Harmonic Minor</h3>
            <p className="text-neutral-500 text-sm font-mono mt-1">1 – 2 – b3 – 4 – 5 – b6 – 7</p>
            <p className="text-neutral-300 mt-2 text-sm">
              The natural minor with a raised 7th. The 1.5-step gap between b6 and 7 creates
              an exotic, almost classical sound. This is the Yngwie Malmsteen / neoclassical
              metal scale.
            </p>
          </div>
        </div>

        <p className="text-neutral-300 mb-4">
          Here&apos;s a harmonic minor lick in A. Listen for that distinctive b6→7 gap
          (F→G#):
        </p>
        <AlphaTexStatic
          alphatex={`\\title "Harmonic Minor Lick"
\\tempo 120
\\instrument 29
.
:16 5.6 7.6 8.6 5.5 7.5 8.5 5.4 6.4 |
7.4 5.3 6.3 7.3 5.2 6.2 8.2 6.2 |
5.2 7.3 6.3 5.3 7.4 6.4 5.4 8.5 |
7.5 5.5 8.6 7.6 :2 5.6`}
        />
        <p className="text-neutral-400 text-sm mt-2">
          Ascending through positions, then descending back. The run resolves on the root (A, fret 5, string 6).
        </p>
      </section>

      {/* Step 8: Writing a Solo */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Step 8: Writing a Solo</h2>
        <p className="text-neutral-300 mb-3">
          A metal solo isn&apos;t just fast notes — it&apos;s about{" "}
          <strong className="text-white">tension and resolution</strong>. The recipe:
        </p>
        <ul className="list-disc list-inside text-neutral-300 mb-4 space-y-1">
          <li>Start with <strong className="text-white">minor pentatonic</strong> phrases for a solid foundation</li>
          <li>Add <strong className="text-white">chromatic passing tones</strong> (notes between scale tones) for speed and aggression</li>
          <li>End phrases on <strong className="text-white">chord tones</strong> — root, b3, or 5th — so they land solidly</li>
          <li>Build intensity: start melodic, get faster, end with a climactic bend</li>
        </ul>
        <AlphaTexStatic
          alphatex={`\\title "Mini Solo"
\\tempo 130
\\instrument 29
.
:8 12.2 15.1 :16 12.1 13.1 14.1 15.1 :8 12.2 14.2 |
:16 15.2 14.2 12.2 14.2 12.2 10.2 12.3 10.3 |
:8 12.3 :16 10.3 12.3 :8 9.3 :16 10.3 9.3 7.3 9.3 |
:4 7.4{b (0 4)} :8 9.4 7.4 :2 5.4`}
        />
        <p className="text-neutral-400 text-sm mt-2">
          Bar 1: pentatonic phrase at the 12th fret. Bar 2: chromatic descending run (13-14 are
          the passing tones). Bar 3: working down the neck. Bar 4: bend for the climax, resolve
          on the root.
        </p>
      </section>

      {/* Step 9: Arranging Your Song */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Step 9: Arranging Your Song</h2>
        <p className="text-neutral-300 mb-4">
          You now have all the building blocks. Here&apos;s how they fit into a song:
        </p>

        <div className="bg-neutral-800 rounded-lg p-5 mb-6">
          <div className="space-y-3">
            {[
              { section: "Intro", desc: "Set the mood. A clean arpeggio, feedback, or dive straight into the main riff.", blocks: "Steps 1–2" },
              { section: "Verse", desc: "Palm-muted chugging — restrained, leaving room for vocals.", blocks: "Steps 2–3" },
              { section: "Pre-Chorus", desc: "Build intensity. Open up the muting, add chord movement.", blocks: "Steps 3–4" },
              { section: "Chorus", desc: "The hook. Power chords ring out, biggest riff, most memorable part.", blocks: "Steps 1, 3" },
              { section: "Bridge", desc: "Change the feel. Half-time breakdown, clean section, or key change.", blocks: "Step 6" },
              { section: "Solo", desc: "Your lead moment. Build from melody into speed, end with a big bend.", blocks: "Steps 7–8" },
              { section: "Outro", desc: "Reprise the main riff or end with a hard stop.", blocks: "Steps 2–3" },
            ].map(({ section, desc, blocks }) => (
              <div key={section} className="flex gap-4">
                <span className="text-blue-400 font-semibold w-24 shrink-0">{section}</span>
                <span className="text-neutral-300 flex-1">{desc}</span>
                <span className="text-neutral-500 text-sm shrink-0">{blocks}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-neutral-800 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-white mb-3">Your Checklist</h3>
          <ol className="space-y-2 text-neutral-300 list-decimal list-inside">
            <li><strong className="text-white">Pick a key and tuning.</strong> E minor (standard) or D minor (Drop D) to start.</li>
            <li><strong className="text-white">Choose a progression.</strong> i – bVI – bVII – i is your go-to.</li>
            <li><strong className="text-white">Write the main riff.</strong> Palm-muted power chords with rhythmic variation.</li>
            <li><strong className="text-white">Add a single-note riff.</strong> Use Phrygian or natural minor for a contrasting section.</li>
            <li><strong className="text-white">Write a solo.</strong> Pentatonic foundation, chromatic passing tones, strong resolution.</li>
            <li><strong className="text-white">Arrange the sections.</strong> Play through the whole structure and adjust.</li>
          </ol>
        </div>
      </section>

      {/* Bonus: More Progressions */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4">More Progressions to Try</h2>
        <p className="text-neutral-300 mb-4">
          Once you&apos;re comfortable with i – bVI – bVII – i, try these:
        </p>

        <div className="space-y-3">
          <div className="bg-neutral-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-1">i – bII – i</h3>
            <p className="text-neutral-400 text-sm">Em – F5 – Em</p>
            <p className="text-neutral-300 text-sm mt-1">
              The Phrygian half-step. Maximum tension from a single semitone movement.
              The sound of doom metal and death metal intros.
            </p>
          </div>

          <div className="bg-neutral-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-1">i – bVII – bVI – bVII</h3>
            <p className="text-neutral-400 text-sm">Em – D5 – C5 – D5</p>
            <p className="text-neutral-300 text-sm mt-1">
              Descending with a bounce. Great for driving verse riffs that keep momentum.
            </p>
          </div>

          <div className="bg-neutral-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-1">i – iv – v</h3>
            <p className="text-neutral-400 text-sm">Em – Am – Bm</p>
            <p className="text-neutral-300 text-sm mt-1">
              Natural minor i-iv-v. Straightforward and dark. The minor v keeps it heavy
              without the brightness of a major V chord.
            </p>
          </div>

          <div className="bg-neutral-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-1">i – bVI – bIII – bVII</h3>
            <p className="text-neutral-400 text-sm">Em – C5 – G5 – D5</p>
            <p className="text-neutral-300 text-sm mt-1">
              The epic/melodic progression. Sweeping and anthemic — perfect for power metal
              choruses and melodic death metal.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
