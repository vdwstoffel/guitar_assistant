import { describe, it, expect } from "vitest";
import { describeUploadFailures } from "./uploadErrors";

describe("describeUploadFailures", () => {
  it("says nothing when every file imported", () => {
    expect(describeUploadFailures([{ name: "a.gp5", success: true }])).toBeNull();
  });

  it("names the file and repeats the reason", () => {
    // The sentence comes from the upload route, which already explains
    // itself ("was already imported from a file of this name", "contains no
    // music"). Showing it verbatim beats inventing a second vocabulary.
    expect(
      describeUploadFailures([
        { name: "a.gp5", success: false, error: '"Fear of the Dark" was already imported from a file of this name.' },
      ]),
    ).toBe('a.gp5: "Fear of the Dark" was already imported from a file of this name.');
  });

  it("lists every failure, one per line", () => {
    expect(
      describeUploadFailures([
        { name: "a.gp5", success: false, error: "Bad" },
        { name: "b.gp5", success: true },
        { name: "c.gp5", success: false, error: "Worse" },
      ]),
    ).toBe("a.gp5: Bad\nc.gp5: Worse");
  });

  it("still says something when the route gave no reason", () => {
    expect(describeUploadFailures([{ name: "a.gp5", success: false }])).toBe(
      "a.gp5: could not be imported",
    );
  });

  it("survives a response that is not the shape we expect", () => {
    // A 500 returns { error } with no results array at all.
    expect(describeUploadFailures(undefined)).toBeNull();
    expect(describeUploadFailures(null)).toBeNull();
    expect(describeUploadFailures({ error: "Upload failed" })).toBeNull();
    expect(describeUploadFailures([null, "nonsense"])).toBeNull();
  });
});
