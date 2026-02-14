// TypeScript interfaces for Guitar Tab Player (Guitar Pro files)

// GuitarTab model (matches Prisma schema)
export interface GuitarTab {
  id: string;
  title: string;
  filePath: string;
  tempo: number | null;
  timeSignature: string | null;
  duration: number | null;
  completed: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}
