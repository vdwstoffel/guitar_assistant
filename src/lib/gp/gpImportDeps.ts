import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { parseGpMetadata } from "./gpMetadata";
import type { GpImportDeps } from "./importGpBytes";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

/**
 * The real database and disk behind an import.
 *
 * Deliberately free of decisions: everything about what may be imported,
 * and under what name, lives in `importGpBytes`, where it can be tested
 * without the generated Prisma client.
 */
export function gpImportDeps(): GpImportDeps {
  return {
    findByPath: (filePath) =>
      prisma.gpSong.findUnique({ where: { filePath }, select: { title: true } }),
    create: async (row) => void (await prisma.gpSong.create({ data: row })),
    writeFile: async (relativePath, bytes) => {
      const absolute = path.join(path.resolve(MUSIC_DIR), relativePath);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, bytes);
    },
    parseMetadata: parseGpMetadata,
  };
}
