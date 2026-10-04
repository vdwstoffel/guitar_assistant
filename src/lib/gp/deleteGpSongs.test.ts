import { describe, it, expect, vi } from "vitest";
import { deleteGpSongsForTracks, type GpSongRemovalDeps } from "./deleteGpSongs";

function fakeDeps(
  songs: { id: string; filePath: string }[],
  over: Partial<GpSongRemovalDeps> = {},
): GpSongRemovalDeps & { removed: string[][]; unlinked: string[] } {
  const removed: string[][] = [];
  const unlinked: string[] = [];
  return {
    removed,
    unlinked,
    find: vi.fn(async () => songs),
    remove: vi.fn(async (ids: string[]) => {
      removed.push(ids);
    }),
    unlink: vi.fn(async (filePath: string) => {
      unlinked.push(filePath);
    }),
    ...over,
  };
}

describe("deleteGpSongsForTracks", () => {
  it("removes the rows and unlinks the files", async () => {
    const deps = fakeDeps([
      { id: "gp-1", filePath: "GpSongs/a.gp5" },
      { id: "gp-2", filePath: "GpSongs/b.gp5" },
    ]);
    const count = await deleteGpSongsForTracks(["track-1"], deps);
    expect(count).toBe(2);
    expect(deps.removed).toEqual([["gp-1", "gp-2"]]);
    expect(deps.unlinked).toEqual(["GpSongs/a.gp5", "GpSongs/b.gp5"]);
  });

  it("still removes the row when the file is already gone", async () => {
    // The scan deletes a track precisely because its files vanished, so this
    // is the ordinary case, not the exceptional one. A throw here would
    // leave a row that can never be deleted.
    const deps = fakeDeps([{ id: "gp-1", filePath: "GpSongs/gone.gp5" }], {
      unlink: vi.fn(async () => {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }),
    });
    await expect(deleteGpSongsForTracks(["track-1"], deps)).resolves.toBe(1);
    expect(deps.removed).toEqual([["gp-1"]]);
  });

  it("does nothing for a track with no imports", async () => {
    const deps = fakeDeps([]);
    expect(await deleteGpSongsForTracks(["track-1"], deps)).toBe(0);
    expect(deps.remove).not.toHaveBeenCalled();
    expect(deps.unlink).not.toHaveBeenCalled();
  });

  it("does not even look when given no tracks", async () => {
    const deps = fakeDeps([{ id: "gp-1", filePath: "GpSongs/a.gp5" }]);
    expect(await deleteGpSongsForTracks([], deps)).toBe(0);
    expect(deps.find).not.toHaveBeenCalled();
  });

  it("deletes the rows before touching the disk", async () => {
    // Row first, file second: a row with no file is a visible broken entry
    // the user can delete; a file with no row is invisible litter nothing
    // can reach.
    const order: string[] = [];
    const deps = fakeDeps([{ id: "gp-1", filePath: "GpSongs/a.gp5" }], {
      remove: vi.fn(async () => {
        order.push("remove");
      }),
      unlink: vi.fn(async () => {
        order.push("unlink");
      }),
    });
    await deleteGpSongsForTracks(["track-1"], deps);
    expect(order).toEqual(["remove", "unlink"]);
  });
});
