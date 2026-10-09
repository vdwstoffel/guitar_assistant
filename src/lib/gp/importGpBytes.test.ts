import { describe, it, expect } from "vitest";
import { importGpBytes, type GpImportDeps, type GpSongRow } from "./importGpBytes";
import type { GpMetadata } from "./gpMetadata";

const BYTES = new Uint8Array([1, 2, 3]);

const META: GpMetadata = {
  title: "A Song",
  artist: "A Band",
  tempo: 114,
  trackNames: ["Guitar", "Bass"],
  barCount: 177,
};

function makeDeps(overrides: Partial<GpImportDeps> = {}) {
  const written: { path: string; bytes: Uint8Array }[] = [];
  const created: GpSongRow[] = [];
  const deps: GpImportDeps = {
    findByPath: async () => null,
    create: async (row) => void created.push(row),
    writeFile: async (path, bytes) => void written.push({ path, bytes }),
    parseMetadata: async () => META,
    ...overrides,
  };
  return { deps, written, created };
}

describe("importGpBytes", () => {
  it("writes the file and records the song", async () => {
    const { deps, written, created } = makeDeps();

    const result = await importGpBytes({ bytes: BYTES, fileName: "song.gp" }, deps);

    expect(result).toEqual({ name: "song.gp", success: true });
    expect(written).toEqual([{ path: "GpSongs/song.gp", bytes: BYTES }]);
    expect(created[0]).toMatchObject({
      title: "A Song",
      artist: "A Band",
      filePath: "GpSongs/song.gp",
      tempo: 114,
      barCount: 177,
      jamTrackId: null,
      trackId: null,
    });
  });

  it("stores track names as json, since the column is text", async () => {
    const { deps, created } = makeDeps();
    await importGpBytes({ bytes: BYTES, fileName: "song.gp" }, deps);
    expect(JSON.parse(created[0].trackNames)).toEqual(["Guitar", "Bass"]);
  });

  it("hangs the song off the jam track it was imported for", async () => {
    const { deps, created } = makeDeps();
    await importGpBytes({ bytes: BYTES, fileName: "song.gp", jamTrackId: "jam-1" }, deps);
    expect(created[0]).toMatchObject({ jamTrackId: "jam-1", trackId: null });
  });

  it("hangs the song off the lesson exercise it was imported for", async () => {
    const { deps, created } = makeDeps();
    await importGpBytes({ bytes: BYTES, fileName: "song.gp", trackId: "track-1" }, deps);
    expect(created[0]).toMatchObject({ jamTrackId: null, trackId: "track-1" });
  });

  it("refuses a file that is not a Guitar Pro file", async () => {
    const { deps, written, created } = makeDeps();

    const result = await importGpBytes({ bytes: BYTES, fileName: "notes.txt" }, deps);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a guitar pro file/i);
    expect(written).toEqual([]);
    expect(created).toEqual([]);
  });

  it("refuses a name already taken, naming what holds it", async () => {
    const { deps, written } = makeDeps({ findByPath: async () => ({ title: "Older Import" }) });

    const result = await importGpBytes({ bytes: BYTES, fileName: "song.gp" }, deps);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Older Import");
    expect(written).toEqual([]);
  });

  it("does not put an unreadable file on disk", async () => {
    // Parsing first is what keeps the music folder free of orphans: a file
    // that cannot be read has no row, so nothing would ever clean it up.
    const { deps, written, created } = makeDeps({
      parseMetadata: async () => {
        throw new Error("This file contains no music.");
      },
    });

    const result = await importGpBytes({ bytes: BYTES, fileName: "broken.gp" }, deps);

    expect(result).toEqual({ name: "broken.gp", success: false, error: "This file contains no music." });
    expect(written).toEqual([]);
    expect(created).toEqual([]);
  });

  it("strips characters that cannot go in a file name", async () => {
    const { deps, written, created } = makeDeps();

    const result = await importGpBytes({ bytes: BYTES, fileName: 'a/b:c?song.gp' }, deps);

    expect(written[0].path).toBe("GpSongs/a_b_c_song.gp");
    expect(created[0].filePath).toBe("GpSongs/a_b_c_song.gp");
    // The result names the file the user chose, not the one we settled on.
    expect(result.name).toBe("a/b:c?song.gp");
  });

  it("falls back to the file's own name when the score declares no title", async () => {
    const { deps, created } = makeDeps({
      parseMetadata: async (_bytes, fallbackTitle) => ({ ...META, title: fallbackTitle }),
    });

    await importGpBytes({ bytes: BYTES, fileName: "my-exercise.gp" }, deps);

    expect(created[0].title).toBe("my-exercise");
  });

  it("reports a failed write rather than throwing out of the route", async () => {
    const { deps, created } = makeDeps({
      writeFile: async () => {
        throw new Error("ENOSPC: no space left on device");
      },
    });

    const result = await importGpBytes({ bytes: BYTES, fileName: "song.gp" }, deps);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ENOSPC/);
    expect(created).toEqual([]);
  });
});
