const KEY = "videoVolumeById";

function readMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function getVideoVolume(id: string): number {
  const v = readMap()[id];
  return typeof v === "number" ? v : 1;
}

export function setVideoVolume(id: string, v: number): void {
  if (typeof window === "undefined") return;
  const map = readMap();
  map[id] = v;
  localStorage.setItem(KEY, JSON.stringify(map));
}
