export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getPdfAbbreviation(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("lead")) return "L";
  if (lower.includes("rhythm")) return "R";
  if (lower.includes("bass")) return "B";
  return name.charAt(0).toUpperCase();
}

/** Sort priority: Rhythm first, then Lead, then Bass, then others */
export function pdfSortPriority(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("rhythm")) return 0;
  if (lower.includes("lead")) return 1;
  if (lower.includes("bass")) return 2;
  return 3;
}

export function sortPdfs<T extends { name: string }>(pdfs: T[]): T[] {
  return [...pdfs].sort((a, b) => pdfSortPriority(a.name) - pdfSortPriority(b.name));
}

export function formatDurationLong(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
