// Progress state shared by Track and BookVideo.
//
// "Resetting progress" means returning an item to its default state: neither
// completed nor in-progress. It deliberately does NOT clear play history —
// lastPlayedAt and favorite survive a reset.

export interface ResetProgressData {
  completed: false;
  completedAt: null;
  inProgress: false;
}

// Fields a progress reset must never write. Asserted in progress.test.ts so a
// future edit cannot silently widen the reset into the user's play history.
export const PRESERVED_PROGRESS_FIELDS = [
  "lastPlayedAt",
  "favorite",
] as const;

// The field-set that clears completed / in-progress state.
export function resetProgressData(): ResetProgressData {
  return {
    completed: false,
    completedAt: null,
    inProgress: false,
  };
}
