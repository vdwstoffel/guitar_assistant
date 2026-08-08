export interface LoopInput {
  name: string;
  startTime: number;
  endTime: number;
}

// Validate and normalize a raw loop payload (from a request body or client).
// A loop is a named region on a track: name must be non-empty, and
// startTime/endTime must be finite, non-negative, with startTime < endTime.
export function validateLoopInput(
  raw: unknown
): { ok: true; value: LoopInput } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid loop payload" };
  }
  const { name, startTime, endTime } = raw as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, error: "Missing or empty field: name" };
  }
  if (typeof startTime !== "number" || !Number.isFinite(startTime) || startTime < 0) {
    return { ok: false, error: "Invalid startTime" };
  }
  if (typeof endTime !== "number" || !Number.isFinite(endTime) || endTime < 0) {
    return { ok: false, error: "Invalid endTime" };
  }
  if (startTime >= endTime) {
    return { ok: false, error: "startTime must be less than endTime" };
  }

  return { ok: true, value: { name: name.trim(), startTime, endTime } };
}
