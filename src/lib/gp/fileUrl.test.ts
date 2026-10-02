import { describe, it, expect } from "vitest";
import { gpFileUrl } from "./fileUrl";

describe("gpFileUrl", () => {
  it("builds the serving URL for an ordinary name", () => {
    expect(gpFileUrl("GpSongs/tab.gp5")).toBe("/api/gp/GpSongs/tab.gp5");
  });

  it("encodes a '#', which would otherwise truncate the path at a fragment", () => {
    // sanitizeName strips <>:"/\|?* but not #, so this reaches filePath.
    // Unencoded, the browser sends /api/gp/GpSongs/Money%20 and treats the
    // rest as a fragment: the song imports fine and then never plays.
    expect(gpFileUrl("GpSongs/Money #2.gp5")).toBe("/api/gp/GpSongs/Money%20%232.gp5");
  });

  it("encodes a '%', which would otherwise be an invalid escape", () => {
    expect(gpFileUrl("GpSongs/100% Blues.gp5")).toBe("/api/gp/GpSongs/100%25%20Blues.gp5");
  });

  it("encodes spaces and other awkward characters", () => {
    expect(gpFileUrl("GpSongs/Café & Co.gp5")).toBe("/api/gp/GpSongs/Caf%C3%A9%20%26%20Co.gp5");
  });

  it("keeps the separators between segments, encoding each on its own", () => {
    expect(gpFileUrl("GpSongs/sub dir/x.gp5")).toBe("/api/gp/GpSongs/sub%20dir/x.gp5");
  });
});
