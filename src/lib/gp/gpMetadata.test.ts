import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { parseGpMetadata, isGpFile, resolveTitle, GP_EXTENSIONS } from "./gpMetadata";

// A real Guitar Pro 5 file already in the repo. Its contents are known, so
// it doubles as the fixture for every expectation below.
const FIXTURE = "music/JamTracks/Fear of The Dark/tab.gp5";
const bytes = () => new Uint8Array(fs.readFileSync(FIXTURE));

describe("isGpFile", () => {
  it("accepts every Guitar Pro extension, case-insensitively", () => {
    for (const ext of GP_EXTENSIONS) {
      expect(isGpFile(`song${ext}`), ext).toBe(true);
      expect(isGpFile(`song${ext.toUpperCase()}`), ext).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const name of ["song.mp3", "song.pdf", "song", "song.gp5.txt"]) {
      expect(isGpFile(name), name).toBe(false);
    }
  });
});

describe("resolveTitle", () => {
  // The fixture declares a title, so the fallback path cannot be reached
  // through it. Tested directly instead, or the branch has no cover at all.
  it("prefers what the file declares", () => {
    expect(resolveTitle("Fear of the Dark", "tab")).toBe("Fear of the Dark");
  });

  it("falls back when the file declares nothing", () => {
    expect(resolveTitle(null, "tab")).toBe("tab");
    expect(resolveTitle(undefined, "tab")).toBe("tab");
    expect(resolveTitle("", "tab")).toBe("tab");
  });

  it("falls back when the declared title is only whitespace", () => {
    expect(resolveTitle("   ", "tab")).toBe("tab");
  });

  it("trims a declared title rather than storing the padding", () => {
    expect(resolveTitle("  Master of Puppets  ", "tab")).toBe("Master of Puppets");
  });
});

describe("parseGpMetadata", () => {
  it("reads what the file actually says", async () => {
    const meta = await parseGpMetadata(bytes(), "ignored");
    expect(meta.title).toBe("Fear of the Dark");
    expect(meta.artist).toBe("Iron Maiden");
    expect(meta.tempo).toBe(150);
    expect(meta.trackNames).toEqual(["Lead", "Rhythm", "Bass"]);
    expect(meta.barCount).toBe(351);
  });

  it("keeps the title the file declares", async () => {
    const meta = await parseGpMetadata(bytes(), "my-song");
    expect(meta.title).toBe("Fear of the Dark");
  });

  it("throws on a few bytes that are not a Guitar Pro file", async () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(parseGpMetadata(junk, "junk")).rejects.toThrow();
  });

  it("throws on a FILE-SIZED run of junk, not just a few bytes", async () => {
    // alphaTab's ScoreLoader does not reject unrecognised bytes: it falls
    // through to the AlphaTex importer, which accepts almost anything and
    // yields a degenerate one-track, one-bar, no-note score. Eight bytes are
    // too short for even that, so a tiny input throws for the wrong reason
    // and proves nothing. This is the length that actually gets through.
    const junk = new Uint8Array(64).map((_, i) => (i * 37) % 256);
    await expect(parseGpMetadata(junk, "junk")).rejects.toThrow(/no music/i);
  });
});
