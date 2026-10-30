/**
 * The selectable sound banks for playback, and which one the app uses.
 *
 * A bank is one SoundFont file under `public/soundfont/`. alphaTab's
 * synthesizer reads a track's General MIDI program (24-32 for guitars) out of
 * whichever bank is loaded, so switching banks changes the tone every guitar
 * track sounds like without touching the written notes. The default bank is
 * sonivox — the one shipped with Android and ChromeOS, small and clean enough
 * that note-checking practice stays unambiguous.
 */

export interface SoundBank {
  id: string;
  /** Short label for the picker. */
  label: string;
  /** One line of character, shown under the picker. */
  description: string;
  /** Path under public/. */
  url: string;
}

export const SOUND_BANKS: SoundBank[] = [
  {
    id: "sonivox",
    label: "Default",
    description: "Clean GM instruments (Android/ChromeOS). Best for checking notes.",
    url: "/soundfont/sonivox.sf2",
  },
  {
    id: "timgm6mb",
    label: "TimGM6mb",
    description: "Full General MIDI set, a bit warmer; drums and bass included.",
    url: "/soundfont/timgm6mb.sf2",
  },
  {
    id: "opensoundfont-fm",
    label: "Open SoundFont",
    description: "FM-synthesized GM set (14 MB). More electric-guitar character.",
    url: "/soundfont/opensoundfont-fm-variants.sf2",
  },
];

export const DEFAULT_SOUND_BANK_ID = SOUND_BANKS[0].id;

const STORAGE_KEY = "guitar-assistant.soundBank";
export const SOUND_BANK_CHANGE_EVENT = "ga:sound-bank-change";

export function soundBankById(id: string | null | undefined): SoundBank {
  return SOUND_BANKS.find((b) => b.id === id) ?? SOUND_BANKS[0];
}

export function getSoundBankPreference(): string {
  if (typeof window === "undefined") return DEFAULT_SOUND_BANK_ID;
  const raw = localStorage.getItem(STORAGE_KEY);
  return soundBankById(raw).id;
}

/** The server's first render sees the default bank; stable reference for useSyncExternalStore. */
export function getServerSoundBank(): string {
  return DEFAULT_SOUND_BANK_ID;
}

export function setSoundBankPreference(id: string): void {
  if (typeof window === "undefined") return;
  const bank = soundBankById(id);
  localStorage.setItem(STORAGE_KEY, bank.id);
  window.dispatchEvent(new CustomEvent<string>(SOUND_BANK_CHANGE_EVENT, { detail: bank.id }));
}

export function subscribeToSoundBankChanges(cb: (id: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<string>).detail);
  window.addEventListener(SOUND_BANK_CHANGE_EVENT, handler);
  return () => window.removeEventListener(SOUND_BANK_CHANGE_EVENT, handler);
}
