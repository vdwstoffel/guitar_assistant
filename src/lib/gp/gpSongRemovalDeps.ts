import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import type { GpSongRemovalDeps } from "./deleteGpSongs";

/**
 * The real database and the real disk, for `deleteGpSongsForTracks`.
 *
 * Its own module rather than living beside that function: importing the
 * Prisma client constructs it eagerly, and the generated client targets
 * Alpine (it is built inside Docker), so it cannot initialise on the host
 * where the tests run. Keeping it here leaves `deleteGpSongs.ts` — the part
 * with the logic worth testing — free of that runtime.
 */
export function prismaGpSongRemovalDeps(musicDir: string): GpSongRemovalDeps {
  return {
    find: (trackIds) =>
      prisma.gpSong.findMany({
        where: { trackId: { in: trackIds } },
        select: { id: true, filePath: true },
      }),
    remove: async (ids) => {
      await prisma.gpSong.deleteMany({ where: { id: { in: ids } } });
    },
    unlink: (filePath) => fs.unlink(path.resolve(path.join(musicDir, filePath))),
  };
}
