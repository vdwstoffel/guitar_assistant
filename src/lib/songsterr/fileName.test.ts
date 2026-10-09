import { describe, it, expect } from "vitest";
import { gpFileNameFor } from "./fileName";

describe("gpFileNameFor", () => {
  it("names the file after the artist and the song", () => {
    // Both, because a title alone collides often: the import is rejected
    // when the name is taken, and two bands' songs share a title routinely.
    expect(gpFileNameFor("A Song", "A Band")).toBe("A Band - A Song.gp");
  });

  it("leaves the artist out when the page did not name one", () => {
    // "Unknown Artist" is the placeholder our own state reader substitutes,
    // so it means absence rather than a band of that name.
    expect(gpFileNameFor("A Song", "Unknown Artist")).toBe("A Song.gp");
    expect(gpFileNameFor("A Song", "")).toBe("A Song.gp");
  });

  it("collapses whitespace so the name survives a round trip through a shell", () => {
    expect(gpFileNameFor("  A   Song \n", " A  Band ")).toBe("A Band - A Song.gp");
  });

  it("always ends in .gp, which is what the importer accepts", () => {
    expect(gpFileNameFor("A Song", "A Band").endsWith(".gp")).toBe(true);
  });

  it("does not double the extension when the title already carries one", () => {
    expect(gpFileNameFor("A Song.gp", "A Band")).toBe("A Band - A Song.gp");
  });
});
