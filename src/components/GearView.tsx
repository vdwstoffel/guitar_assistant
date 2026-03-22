"use client";

import { useState, useRef } from "react";

type GearTab = "pedals";

const tabs: { id: GearTab; label: string }[] = [
  { id: "pedals", label: "Pedals" },
];

interface PedalKnob {
  name: string;
  description: string;
  low: string;
  high: string;
}

interface PresetKnob {
  name: string;
  value: number; // 0-100 percentage
}

interface PedalPreset {
  name: string;
  description: string;
  knobs: PresetKnob[];
}

interface Pedal {
  id: string;
  name: string;
  brand: string;
  type: string;
  controlType?: "knob" | "slider";
  description: string;
  knobs: PedalKnob[];
  tips: string[];
  presets: PedalPreset[];
}

// Ordered in signal chain: Guitar → OD → Distortion → Noise Gate → EQ → Delay → Reverb → Amp
const pedals: Pedal[] = [
  {
    id: "behringer-od300",
    name: "Overdrive/Distortion OD300",
    brand: "Behringer",
    type: "Overdrive / Distortion",
    description:
      "A 2-mode overdrive and distortion pedal with a blend control that lets you morph between pure overdrive and full distortion. True bypass design. Great for everything from bluesy breakup to hard rock crunch — though for extreme metal you'll want something heavier.",
    knobs: [
      {
        name: "Level",
        description: "Output volume. Match your bypass level or boost above it for solos.",
        low: "Unity gain — keeping volume consistent when kicking the pedal on.",
        high: "Volume boost for leads and solos that need to stand out.",
      },
      {
        name: "Tone",
        description: "EQ control from warm and dark to bright and cutting.",
        low: "Warm, smooth, neck-pickup-style tone — great for jazz and blues leads.",
        high: "Bright, biting attack — cuts through a mix, good for rhythm crunch.",
      },
      {
        name: "Drive",
        description: "Amount of gain, from subtle breakup to heavy saturation.",
        low: "Clean boost or edge-of-breakup — pushing a tube amp into natural crunch.",
        high: "Thick, saturated distortion with long sustain for lead work and power chords.",
      },
      {
        name: "Mode",
        description: "Blends between overdrive (left) and distortion (right). Middle positions mix both.",
        low: "Pure overdrive — warm, vintage, amp-like breakup with dynamics.",
        high: "Full distortion — aggressive, compressed, high-gain with more sustain.",
      },
    ],
    tips: [
      "The Mode knob isn't a switch — it's a continuous blend. Experiment with positions between OD and Dist for unique tones.",
      "Use it as a clean boost: Drive low, Level high, Mode on overdrive — pushes your amp into natural breakup.",
      "Stacking with another drive pedal works great — use the OD300 as a low-gain boost into a heavier distortion.",
      "Roll the Tone back when using the bridge pickup to tame harshness, or boost it on the neck pickup for clarity.",
      "For heavier styles, blend Mode toward distortion but keep Drive moderate — you get tightness without mud.",
    ],
    presets: [
      {
        name: "Blues Breakup",
        description: "Touch-sensitive crunch that cleans up with your volume knob — think SRV, BB King, John Mayer.",
        knobs: [
          { name: "Level", value: 50 },
          { name: "Tone", value: 45 },
          { name: "Drive", value: 35 },
          { name: "Mode", value: 20 },
        ],
      },
      {
        name: "Classic Rock Crunch",
        description: "Warm, punchy overdrive with grit — think AC/DC, Led Zeppelin, Hendrix rhythm tones.",
        knobs: [
          { name: "Level", value: 50 },
          { name: "Tone", value: 55 },
          { name: "Drive", value: 55 },
          { name: "Mode", value: 35 },
        ],
      },
      {
        name: "Hard Rock Drive",
        description: "Thick, saturated crunch blending OD and distortion — think Guns N' Roses, Foo Fighters.",
        knobs: [
          { name: "Level", value: 55 },
          { name: "Tone", value: 55 },
          { name: "Drive", value: 65 },
          { name: "Mode", value: 60 },
        ],
      },
      {
        name: "Clean Boost",
        description: "Transparent volume boost to push your amp or hit the front of another pedal harder.",
        knobs: [
          { name: "Level", value: 70 },
          { name: "Tone", value: 50 },
          { name: "Drive", value: 15 },
          { name: "Mode", value: 15 },
        ],
      },
      {
        name: "Full Distortion",
        description: "Max aggression from the OD300 — tight rhythm crunch for punk, grunge, and hard rock.",
        knobs: [
          { name: "Level", value: 50 },
          { name: "Tone", value: 50 },
          { name: "Drive", value: 75 },
          { name: "Mode", value: 85 },
        ],
      },
    ],
  },
  {
    id: "behringer-um300",
    name: "Ultra Metal UM300",
    brand: "Behringer",
    type: "Distortion",
    description:
      "A heavy metal distortion pedal — essentially a budget clone of the Boss Metal Zone MT-2. Delivers thick, high-gain tube-style distortion with endless sustain. Great for metal, hard rock, and any genre needing aggressive distortion.",
    knobs: [
      {
        name: "Distortion",
        description:
          "Controls the amount of gain/saturation. Higher = more distortion and sustain.",
        low: "Bluesy crunch, classic rock rhythms, or adding grit to a clean tone.",
        high: "Sustained lead lines, heavy riffing, and wall-of-sound metal tones.",
      },
      {
        name: "Level",
        description:
          "Overall output volume. Use this to match your bypassed signal level.",
        low: "Keeping volume even with your clean signal for rhythm playing.",
        high: "Boosting above clean level so solos and leads cut through the mix.",
      },
      {
        name: "High",
        description: "Treble EQ — adds sizzle and bite, or rolls off harshness.",
        low: "Warmer, smoother lead tones — taming pick noise on neck pickup.",
        high: "Aggressive palm mutes, cutting through a dense mix, adding pick attack.",
      },
      {
        name: "Low",
        description: "Bass EQ — tighten up the low end or add thump.",
        low: "Fast riffing and drop tunings — keeps palm mutes tight and defined.",
        high: "Heavy, full-bodied chords and doom/sludge tones with lots of weight.",
      },
      {
        name: "Mid Freq",
        description:
          "Selects which mid frequency to target (sweeps 200Hz to 5kHz).",
        low: "Shaping body and thickness (~200Hz) — good for rhythm tone sculpting.",
        high: "Shaping presence and bite (~5kHz) — good for lead tone clarity.",
      },
      {
        name: "Mid Gain",
        description:
          "Boosts or cuts the selected mid frequency by up to ±15dB.",
        low: "Scooped modern metal — Metallica-style rhythm tones, big solo sound.",
        high: "Punchy classic metal — cutting through a band mix, Megadeth-style bite.",
      },
    ],
    tips: [
      "Don't max the Distortion knob — you lose clarity and get muddy. Keep it around 50–70% for usable heavy tones.",
      "Don't scoop mids too hard — fully cutting mids sounds cool alone but disappears in a band mix. Keep mids near flat or slightly cut.",
      "Keep High and Low moderate — too much of either adds noise or mud. Start at noon and adjust.",
      "The Mid Freq + Mid Gain combo is the secret weapon — sweep the frequency to find the sweet spot for your guitar/amp combo.",
    ],
    presets: [
      {
        name: "Classic Metal",
        description: "Balanced, crunchy tone with punch — think Black Sabbath, Judas Priest. Cuts through without being harsh.",
        knobs: [
          { name: "Distortion", value: 60 },
          { name: "Level", value: 50 },
          { name: "High", value: 50 },
          { name: "Low", value: 45 },
          { name: "Mid Freq", value: 40 },
          { name: "Mid Gain", value: 40 },
        ],
      },
      {
        name: "Modern Djent",
        description: "Tight, percussive, and razor-sharp — think Meshuggah, Periphery. Scooped mids with snappy low end.",
        knobs: [
          { name: "Distortion", value: 50 },
          { name: "Level", value: 50 },
          { name: "High", value: 60 },
          { name: "Low", value: 30 },
          { name: "Mid Freq", value: 25 },
          { name: "Mid Gain", value: 25 },
        ],
      },
      {
        name: "80s Hair Metal",
        description: "Bright, sizzly, and saturated — think Def Leppard, Mötley Crüe. Singing leads with boosted highs and mids.",
        knobs: [
          { name: "Distortion", value: 70 },
          { name: "Level", value: 55 },
          { name: "High", value: 65 },
          { name: "Low", value: 50 },
          { name: "Mid Freq", value: 55 },
          { name: "Mid Gain", value: 60 },
        ],
      },
      {
        name: "Thrash Metal",
        description: "Aggressive, tight, and razor-edged — think Slayer, Megadeth. Fast palm mutes stay defined with cutting mids.",
        knobs: [
          { name: "Distortion", value: 75 },
          { name: "Level", value: 50 },
          { name: "High", value: 60 },
          { name: "Low", value: 35 },
          { name: "Mid Freq", value: 50 },
          { name: "Mid Gain", value: 55 },
        ],
      },
      {
        name: "Death Metal",
        description: "Massive, brutal, and crushing — think Cannibal Corpse, Morbid Angel. Scooped mids with heavy low end and max gain.",
        knobs: [
          { name: "Distortion", value: 85 },
          { name: "Level", value: 50 },
          { name: "High", value: 45 },
          { name: "Low", value: 60 },
          { name: "Mid Freq", value: 30 },
          { name: "Mid Gain", value: 30 },
        ],
      },
    ],
  },
  {
    id: "behringer-nr300",
    name: "Noise Reducer NR300",
    brand: "Behringer",
    type: "Noise Gate",
    description:
      "A noise reduction/gate pedal — a clone of the Boss NS-2. Silences hum, buzz, and hiss when you're not playing, while letting your actual playing through cleanly. Features a built-in effects loop (Send/Return) so it can gate only your noisy pedals.",
    knobs: [
      {
        name: "Threshold",
        description: "Sets the signal level below which noise gets reduced. Higher = more aggressive gating.",
        low: "Only gates very quiet noise — subtle cleanup for low-gain setups.",
        high: "Gates everything below loud playing — taming high-gain buzz and single-coil hum.",
      },
      {
        name: "Decay",
        description: "How quickly the gate closes after your signal drops below the threshold.",
        low: "Gate snaps shut instantly — tight and precise, great for staccato riffing.",
        high: "Gate fades out slowly — natural note decay, good for sustained leads and cleans.",
      },
      {
        name: "Mode",
        description: "Toggle switch: Reduction mode reduces noise gradually. Mute mode cuts signal completely when below threshold.",
        low: "Reduction — gentle, transparent noise reduction that preserves natural feel.",
        high: "Mute — hard gate, completely silent between notes. Best for high-gain metal.",
      },
    ],
    tips: [
      "Use the Send/Return loop — put your noisy pedals (distortion, fuzz, compressor) in the loop for the best gating results.",
      "Start with Threshold low and slowly increase until the noise disappears between notes — too high and it'll choke your sustain.",
      "Fast Decay is great for tight metal palm mutes, but can sound unnatural on clean or lead tones.",
      "Place it early in your chain with dirt pedals in its loop, then run time-based effects (delay, reverb) after it.",
      "The second LED lights up whenever noise is being reduced — use it to dial in your threshold visually.",
    ],
    presets: [
      {
        name: "Light Cleanup",
        description: "Subtle noise reduction for low-gain setups — single-coil hum and amp hiss tamed transparently.",
        knobs: [
          { name: "Threshold", value: 30 },
          { name: "Decay", value: 60 },
        ],
      },
      {
        name: "High-Gain Taming",
        description: "Controls heavy distortion buzz while keeping note sustain — think rhythm tones with a Mesa or 5150.",
        knobs: [
          { name: "Threshold", value: 55 },
          { name: "Decay", value: 45 },
        ],
      },
      {
        name: "Tight Metal Gate",
        description: "Hard, fast gate for staccato riffs and djent chugs — dead silence between hits.",
        knobs: [
          { name: "Threshold", value: 70 },
          { name: "Decay", value: 20 },
        ],
      },
      {
        name: "Lead Friendly",
        description: "Cleans up noise without choking sustain — let pinch harmonics and bends ring out naturally.",
        knobs: [
          { name: "Threshold", value: 35 },
          { name: "Decay", value: 75 },
        ],
      },
    ],
  },
  {
    id: "behringer-eq700",
    name: "Graphic Equalizer EQ700",
    brand: "Behringer",
    type: "EQ",
    controlType: "slider",
    description:
      "A 7-band graphic equalizer pedal — a clone of the Boss GE-7. Each slider boosts or cuts its frequency by up to ±15dB, plus a master Level slider. Use it to shape your tone, fix problem frequencies, or create a solo boost.",
    knobs: [
      {
        name: "100Hz",
        description: "Sub-bass and low-end thump. Affects the deepest frequencies of your guitar signal.",
        low: "Removing rumble, tightening up drop-tuned riffing.",
        high: "Adding fullness and weight to clean tones or thin-sounding guitars.",
      },
      {
        name: "200Hz",
        description: "Warmth and body. Where the 'thickness' of your guitar lives.",
        low: "Cleaning up muddiness, tightening rhythm tones.",
        high: "Adding warmth to bright or thin guitars, fuller clean tones.",
      },
      {
        name: "400Hz",
        description: "Low-mids and 'boxiness'. Key feedback zone for acoustic guitars.",
        low: "Removing boxy or honky sound, killing acoustic feedback.",
        high: "Adding punch and definition to rhythm parts.",
      },
      {
        name: "800Hz",
        description: "Core midrange — where your guitar's 'voice' and character lives.",
        low: "Scooping for modern metal tones, reducing nasal quality.",
        high: "Adding aggression and edge, making guitar more vocal and expressive.",
      },
      {
        name: "1.6kHz",
        description: "Upper-mids and presence. Where pick attack and note clarity live.",
        low: "Smoothing out harsh or brittle tones.",
        high: "Cutting through a band mix, adding bite to solos and leads.",
      },
      {
        name: "3.2kHz",
        description: "Presence and articulation. Defines how clearly each note is heard.",
        low: "Taming ice-pick harshness from bridge pickups.",
        high: "Adding crispness and string definition, great for fingerpicking clarity.",
      },
      {
        name: "6.4kHz",
        description: "Treble sparkle and sizzle. The 'air' and brightness on top of your tone.",
        low: "Rolling off fizz from high-gain amps, taming hiss and noise.",
        high: "Adding shimmer to cleans, sparkle to acoustic strumming.",
      },
      {
        name: "Level",
        description: "Master output volume, ±15dB. Use to compensate for EQ changes or as a clean boost.",
        low: "Keeping volume even after boosting frequencies.",
        high: "Using the EQ as a solo volume boost to cut above the band.",
      },
    ],
    tips: [
      "50% (center) on each slider = flat/no change. Below center = cut, above center = boost.",
      "Small moves make a big difference — start with 3–5dB adjustments, not full cuts or boosts.",
      "With all sliders flat and Level boosted, it works as a clean boost for solos.",
      "Cut problem frequencies rather than boosting everything else — it sounds more natural and introduces less noise.",
      "Place it after your distortion pedal to shape the distorted tone, or before it to change what frequencies get distorted.",
    ],
    presets: [
      {
        name: "Solo Boost",
        description: "Volume and presence bump for lead parts — step on it when it's time to shred.",
        knobs: [
          { name: "100Hz", value: 50 },
          { name: "200Hz", value: 50 },
          { name: "400Hz", value: 50 },
          { name: "800Hz", value: 55 },
          { name: "1.6kHz", value: 60 },
          { name: "3.2kHz", value: 58 },
          { name: "6.4kHz", value: 50 },
          { name: "Level", value: 70 },
        ],
      },
      {
        name: "Mid Scoop",
        description: "Scooped modern metal rhythm tone — big and heavy with a V-shaped EQ curve.",
        knobs: [
          { name: "100Hz", value: 60 },
          { name: "200Hz", value: 55 },
          { name: "400Hz", value: 35 },
          { name: "800Hz", value: 30 },
          { name: "1.6kHz", value: 35 },
          { name: "3.2kHz", value: 55 },
          { name: "6.4kHz", value: 60 },
          { name: "Level", value: 55 },
        ],
      },
      {
        name: "Tight & Focused",
        description: "Cuts low-end mud and adds clarity — great for fast riffing and drop tunings.",
        knobs: [
          { name: "100Hz", value: 35 },
          { name: "200Hz", value: 38 },
          { name: "400Hz", value: 45 },
          { name: "800Hz", value: 55 },
          { name: "1.6kHz", value: 58 },
          { name: "3.2kHz", value: 55 },
          { name: "6.4kHz", value: 50 },
          { name: "Level", value: 50 },
        ],
      },
      {
        name: "Warm & Full",
        description: "Rich, warm clean tone — think jazz or mellow blues with rolled-off highs.",
        knobs: [
          { name: "100Hz", value: 58 },
          { name: "200Hz", value: 62 },
          { name: "400Hz", value: 55 },
          { name: "800Hz", value: 50 },
          { name: "1.6kHz", value: 45 },
          { name: "3.2kHz", value: 42 },
          { name: "6.4kHz", value: 38 },
          { name: "Level", value: 50 },
        ],
      },
      {
        name: "Acoustic Feedback Fix",
        description: "Tames common feedback zones on acoustic-electric guitars for live performance.",
        knobs: [
          { name: "100Hz", value: 42 },
          { name: "200Hz", value: 35 },
          { name: "400Hz", value: 32 },
          { name: "800Hz", value: 50 },
          { name: "1.6kHz", value: 50 },
          { name: "3.2kHz", value: 50 },
          { name: "6.4kHz", value: 48 },
          { name: "Level", value: 50 },
        ],
      },
    ],
  },
  {
    id: "behringer-vd400",
    name: "Vintage Delay VD400",
    brand: "Behringer",
    type: "Analog Delay",
    description:
      "An analog delay pedal — a clone of the Boss DM-2. Produces warm, dark, vintage-sounding echoes with up to 300ms of delay time. The analog circuit naturally rolls off highs on each repeat, giving that classic tape-echo vibe. Great for slapback, ambient textures, and classic rock leads.",
    knobs: [
      {
        name: "Echo",
        description: "Effect output level — how loud the delayed signal is compared to your dry signal.",
        low: "Subtle, background echo — adds depth without being obvious.",
        high: "Prominent, upfront repeats — delay is a featured part of the sound.",
      },
      {
        name: "Intensity",
        description: "Number of repeats (feedback). Controls how many times the echo bounces back.",
        low: "Single slapback echo — one repeat and done.",
        high: "Many repeats that trail off slowly — atmospheric, spacey washes. Max = runaway oscillation.",
      },
      {
        name: "Repeat Rate",
        description: "Delay time from 20ms to 300ms. Note: 'min' = longest delay, 'max' = shortest delay (reversed).",
        low: "Longer delay time (~300ms) — distinct, separated echoes for rhythmic patterns.",
        high: "Shorter delay time (~20ms) — tight slapback, chorus-like thickening, or doubling effect.",
      },
    ],
    tips: [
      "The Repeat Rate knob is reversed — 'min' gives the longest delay and 'max' gives the shortest. Think of it as repeat speed, not delay time.",
      "For slapback: short delay (Repeat Rate toward max), single repeat (Intensity low), Echo to taste.",
      "Analog repeats naturally darken with each echo — this is a feature, not a bug. It sits behind your dry signal beautifully.",
      "Crank Intensity for self-oscillation — creates wild, spacey feedback sounds. Great for experimental noise or ambient transitions.",
      "At very short delay times with moderate Intensity, you get a chorus/vibrato-like thickening effect.",
    ],
    presets: [
      {
        name: "Rockabilly Slapback",
        description: "Quick single echo — think Brian Setzer, early Elvis. Classic country and rockabilly bounce.",
        knobs: [
          { name: "Echo", value: 55 },
          { name: "Intensity", value: 20 },
          { name: "Repeat Rate", value: 75 },
        ],
      },
      {
        name: "Classic Rock Lead",
        description: "Warm trailing echoes behind solos — think David Gilmour, Eric Johnson. Adds depth and space.",
        knobs: [
          { name: "Echo", value: 45 },
          { name: "Intensity", value: 45 },
          { name: "Repeat Rate", value: 35 },
        ],
      },
      {
        name: "Ambient Wash",
        description: "Dark, atmospheric echoes that blend into a reverb-like wash — think post-rock, shoegaze.",
        knobs: [
          { name: "Echo", value: 55 },
          { name: "Intensity", value: 65 },
          { name: "Repeat Rate", value: 25 },
        ],
      },
      {
        name: "Subtle Thickener",
        description: "Very short delay that doubles your signal — adds width and body without obvious echoes.",
        knobs: [
          { name: "Echo", value: 40 },
          { name: "Intensity", value: 25 },
          { name: "Repeat Rate", value: 90 },
        ],
      },
      {
        name: "Oscillation Madness",
        description: "Self-oscillating feedback for experimental noise, ambient swells, and wild soundscapes.",
        knobs: [
          { name: "Echo", value: 60 },
          { name: "Intensity", value: 85 },
          { name: "Repeat Rate", value: 30 },
        ],
      },
    ],
  },
  {
    id: "behringer-dr600",
    name: "Digital Reverb DR600",
    brand: "Behringer",
    type: "Reverb",
    description:
      "A digital stereo reverb pedal with 6 reverb types and 24-bit processing. Covers everything from subtle room ambience to massive hall reverbs and experimental gated/modulated effects. Stereo outputs for true stereo spread.",
    knobs: [
      {
        name: "Level",
        description: "Mix of reverb signal blended with your dry signal.",
        low: "Subtle ambience — just a touch of space to keep your tone from sounding dry.",
        high: "Drenched in reverb — washed-out ambient textures and big atmospheric pads.",
      },
      {
        name: "Tone",
        description: "EQ of the reverb tail — from dark and warm to bright and shimmery.",
        low: "Dark, warm reverb that sits behind your guitar without competing — vintage vibe.",
        high: "Bright, shimmery reverb with sparkle — modern, airy, open sound.",
      },
      {
        name: "Time",
        description: "Reverb decay length — how long the reverb tail rings out.",
        low: "Short decay — tight, controlled ambience that doesn't muddy up fast playing.",
        high: "Long decay — cavernous, sustained wash that lingers after you stop playing.",
      },
      {
        name: "Mode",
        description: "Selects one of 6 reverb types: Spring, Plate, Hall, Room, Gate, or Modulate.",
        low: "Spring/Room — smaller, more natural reverb characters.",
        high: "Hall/Modulate — larger, more dramatic and atmospheric reverb effects.",
      },
    ],
    tips: [
      "Spring mode is classic for surf rock, country, and blues — the bouncy, dripping reverb you hear on Fender amps.",
      "Plate mode is smooth and even — great for vocals and leads where you want reverb that doesn't color the tone much.",
      "Hall mode is big and bright — best for epic solos, ambient passages, and filling out a thin-sounding room.",
      "Room mode is the most natural and subtle — use it as an always-on effect to add life without drowning your tone.",
      "Gate mode cuts off the reverb tail abruptly — great for 80s-style gated snare sounds or keeping reverb tight on heavy riffs.",
      "Modulate mode detunes the reverb tail for a lush, chorus-like shimmer — beautiful for cleans and ambient guitar.",
    ],
    presets: [
      {
        name: "Surf Spring",
        description: "Bouncy, dripping spring reverb — think Dick Dale, The Ventures. Classic surf rock splash.",
        knobs: [
          { name: "Level", value: 60 },
          { name: "Tone", value: 55 },
          { name: "Time", value: 50 },
        ],
      },
      {
        name: "Ambient Clean",
        description: "Lush, shimmery modulated reverb for clean arpeggios — think The Edge, Andy Summers.",
        knobs: [
          { name: "Level", value: 55 },
          { name: "Tone", value: 60 },
          { name: "Time", value: 65 },
        ],
      },
      {
        name: "Big Hall Lead",
        description: "Epic, spacious hall reverb for solos — think Slash, Santana. Makes leads sound huge.",
        knobs: [
          { name: "Level", value: 45 },
          { name: "Tone", value: 50 },
          { name: "Time", value: 60 },
        ],
      },
      {
        name: "Subtle Room",
        description: "Natural room ambience as an always-on effect — just enough space to sound alive, not processed.",
        knobs: [
          { name: "Level", value: 30 },
          { name: "Tone", value: 45 },
          { name: "Time", value: 30 },
        ],
      },
      {
        name: "80s Gated",
        description: "Gated reverb that cuts off sharply — big initial splash then silence. Dramatic and retro.",
        knobs: [
          { name: "Level", value: 55 },
          { name: "Tone", value: 50 },
          { name: "Time", value: 45 },
        ],
      },
    ],
  },
];

/** SVG knob indicator — 0% = 7 o'clock, 100% = 5 o'clock (270° sweep) */
function KnobIcon({ value, label, size = 48 }: { value: number; label: string; size?: number }) {
  const r = size / 2;
  const knobR = r - 6;
  const startAngle = 135; // 7 o'clock
  const sweep = 270;
  const angle = startAngle + (value / 100) * sweep;
  const rad = (angle * Math.PI) / 180;
  // Pointer line from center toward edge
  const pointerLen = knobR - 4;
  const px = r + Math.cos(rad) * pointerLen;
  const py = r + Math.sin(rad) * pointerLen;
  // Tick marks at 0%, 50%, 100%
  const ticks = [0, 50, 100].map((v) => {
    const a = ((startAngle + (v / 100) * sweep) * Math.PI) / 180;
    return {
      x1: r + Math.cos(a) * (knobR + 2),
      y1: r + Math.sin(a) * (knobR + 2),
      x2: r + Math.cos(a) * (knobR + 5),
      y2: r + Math.sin(a) * (knobR + 5),
    };
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring */}
        <circle cx={r} cy={r} r={knobR} fill="#1f2937" stroke="#4b5563" strokeWidth={2} />
        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#6b7280" strokeWidth={1.5} />
        ))}
        {/* Pointer line */}
        <line x1={r} y1={r} x2={px} y2={py} stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" />
        {/* Center dot */}
        <circle cx={r} cy={r} r={3} fill="#60a5fa" />
      </svg>
      <span className="text-[10px] text-gray-400 text-center leading-tight whitespace-nowrap">{label}</span>
    </div>
  );
}

/** Vertical slider indicator — 0% = bottom, 50% = center line, 100% = top */
function SliderIcon({ value, label }: { value: number; label: string }) {
  const w = 28;
  const h = 60;
  const trackX = w / 2;
  const trackTop = 4;
  const trackBot = h - 4;
  const trackH = trackBot - trackTop;
  const centerY = trackTop + trackH / 2;
  // Thumb position: 100% = top, 0% = bottom
  const thumbY = trackBot - (value / 100) * trackH;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* Track groove */}
        <rect x={trackX - 2} y={trackTop} width={4} height={trackH} rx={2} fill="#1f2937" stroke="#4b5563" strokeWidth={1} />
        {/* Center line (flat/0dB) */}
        <line x1={trackX - 6} y1={centerY} x2={trackX + 6} y2={centerY} stroke="#4b5563" strokeWidth={1} />
        {/* Fill from center to thumb */}
        <rect
          x={trackX - 1.5}
          y={Math.min(centerY, thumbY)}
          width={3}
          height={Math.abs(thumbY - centerY)}
          fill="#60a5fa"
          opacity={0.5}
        />
        {/* Thumb */}
        <rect x={trackX - 6} y={thumbY - 3} width={12} height={6} rx={1.5} fill="#60a5fa" />
      </svg>
      <span className="text-[10px] text-gray-400 text-center leading-tight whitespace-nowrap">{label}</span>
    </div>
  );
}

function PedalCard({ pedal }: { pedal: Pedal }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div id={pedal.id} className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden scroll-mt-8">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">{pedal.brand} {pedal.name}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-300 border border-purple-600/40">
            {pedal.type}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed">{pedal.description}</p>

          {/* Knobs */}
          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-2 uppercase tracking-wider">Controls</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-medium py-2 pr-4 w-24">Knob</th>
                  <th className="text-left text-gray-400 font-medium py-2 pr-4">Description</th>
                  <th className="text-left text-gray-400 font-medium py-2 pr-4">Low</th>
                  <th className="text-left text-gray-400 font-medium py-2">High</th>
                </tr>
              </thead>
              <tbody>
                {pedal.knobs.map((knob) => (
                  <tr key={knob.name} className="border-b border-gray-700/50">
                    <td className="py-2 pr-4 text-blue-300 font-medium whitespace-nowrap align-top">{knob.name}</td>
                    <td className="py-2 pr-4 text-gray-400 align-top">{knob.description}</td>
                    <td className="py-2 pr-4 text-orange-300/80 align-top">{knob.low}</td>
                    <td className="py-2 text-red-300/80 align-top">{knob.high}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tips */}
          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-2 uppercase tracking-wider">Tips</h4>
            <ul className="space-y-1.5">
              {pedal.tips.map((tip, i) => (
                <li key={i} className="text-gray-400 text-sm leading-relaxed flex gap-2">
                  <span className="text-yellow-500 shrink-0 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Presets */}
          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-2 uppercase tracking-wider">Starter Presets</h4>
            <div className="space-y-3">
              {pedal.presets.map((preset) => (
                <div key={preset.name} className="bg-gray-900/50 rounded-md px-4 py-3 border border-gray-700/50">
                  <div className="flex items-baseline gap-2">
                    <span className="text-green-300 font-medium text-sm">{preset.name}</span>
                    <span className="text-gray-500 text-xs">{preset.description}</span>
                  </div>
                  <div className="flex gap-5 mt-3">
                    {preset.knobs.map((k) =>
                      pedal.controlType === "slider" ? (
                        <SliderIcon key={k.name} value={k.value} label={k.name} />
                      ) : (
                        <KnobIcon key={k.name} value={k.value} label={k.name} />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GearView() {
  const [activeTab, setActiveTab] = useState<GearTab>("pedals");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToPedal = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-64 shrink-0 border-r border-gray-700 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-semibold text-sm tracking-wide">Gear</h2>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500"
                  : "text-gray-300 hover:bg-gray-700/50 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {activeTab === "pedals" && (
          <div className="px-8 py-8">
            <h1 className="text-2xl font-bold text-white mb-6">Pedals</h1>
            <div className="space-y-4">
              {pedals.map((pedal) => (
                <PedalCard key={pedal.id} pedal={pedal} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar — quick jump */}
      {activeTab === "pedals" && (
        <div className="w-48 shrink-0 border-l border-gray-700 flex flex-col overflow-hidden">
          <div className="px-3 py-3 border-b border-gray-700">
            <h2 className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Signal Chain</h2>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {pedals.map((pedal, i) => (
              <button
                key={pedal.id}
                onClick={() => scrollToPedal(pedal.id)}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 font-mono w-3">{i + 1}</span>
                  <div>
                    <div className="text-xs font-medium group-hover:text-blue-300 transition-colors">{pedal.name}</div>
                    <div className="text-[10px] text-gray-500">{pedal.type}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
