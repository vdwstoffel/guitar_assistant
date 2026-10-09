import { describe, it, expect } from "vitest";
import {
  parseSongsterrUrl,
  extractStateMeta,
  buildRevisionUrl,
  songIdFromTabUrl,
} from "./songsterrUrl";

/** A page shaped like Songsterr's, carrying only the fields we read. */
function pageWithState(state: unknown, id = "state"): string {
  return [
    "<!DOCTYPE html><html><head><title>t</title></head><body>",
    '<div id="root"></div>',
    `<script id="${id}" type="application/json">${JSON.stringify(state)}</script>`,
    "</body></html>",
  ].join("");
}

function validState() {
  return {
    meta: {
      current: {
        songId: 329,
        revisionId: 9446913,
        image: "v0-3-2-abcdef",
        title: "A Song",
        artist: "A Band",
        tracks: [{ partId: 0 }, { partId: 1 }],
      },
    },
  };
}

describe("parseSongsterrUrl", () => {
  it("accepts a songsterr tab url", () => {
    const url = "https://www.songsterr.com/a/wsa/a-band-a-song-tab-s329";
    expect(parseSongsterrUrl(url)).toBe(url);
  });

  it("accepts the host without www", () => {
    expect(parseSongsterrUrl("https://songsterr.com/a/wsa/x-tab-s1")).toBe(
      "https://songsterr.com/a/wsa/x-tab-s1",
    );
  });

  it("trims whitespace around a pasted url", () => {
    // Copying out of a browser's address bar routinely brings a trailing
    // newline with it, and the paste should not be rejected for that.
    expect(parseSongsterrUrl("  https://songsterr.com/a/wsa/x-tab-s1\n")).toBe(
      "https://songsterr.com/a/wsa/x-tab-s1",
    );
  });

  it("upgrades http to https", () => {
    expect(parseSongsterrUrl("http://songsterr.com/a/wsa/x-tab-s1")).toBe(
      "https://songsterr.com/a/wsa/x-tab-s1",
    );
  });

  it("refuses a url from another site", () => {
    expect(() => parseSongsterrUrl("https://ultimate-guitar.com/tab/1")).toThrow(/songsterr/i);
  });

  it("refuses a host that merely ends with songsterr.com", () => {
    // songsterr.com.evil.example is not Songsterr; a naive endsWith check
    // would admit it and we would fetch an attacker's page.
    expect(() => parseSongsterrUrl("https://songsterr.com.evil.example/a")).toThrow(/songsterr/i);
  });

  it("refuses text that is not a url at all", () => {
    expect(() => parseSongsterrUrl("smoke on the water")).toThrow(/url/i);
  });
});

describe("extractStateMeta", () => {
  it("reads the fields needed to locate a revision", () => {
    const meta = extractStateMeta(pageWithState(validState()));
    expect(meta.songId).toBe(329);
    expect(meta.revisionId).toBe(9446913);
    expect(meta.image).toBe("v0-3-2-abcdef");
    expect(meta.title).toBe("A Song");
    expect(meta.artist).toBe("A Band");
    expect(meta.tracks).toHaveLength(2);
  });

  it("falls back when the page names no title or artist", () => {
    const state = validState();
    delete (state.meta.current as Record<string, unknown>).title;
    delete (state.meta.current as Record<string, unknown>).artist;
    const meta = extractStateMeta(pageWithState(state));
    expect(meta.title).toBe("Song");
    expect(meta.artist).toBe("Unknown Artist");
  });

  it("treats a missing tracks array as no tracks rather than throwing", () => {
    const state = validState();
    delete (state.meta.current as Record<string, unknown>).tracks;
    expect(extractStateMeta(pageWithState(state)).tracks).toEqual([]);
  });

  it("explains itself when the page carries no state payload", () => {
    // The likeliest real failure: Songsterr changes the page and this is
    // the error the user sees, so it has to name the cause.
    expect(() => extractStateMeta("<html><body>nothing here</body></html>")).toThrow(
      /songsterr page/i,
    );
  });

  it("explains itself when the payload is not the shape we expect", () => {
    expect(() => extractStateMeta(pageWithState({ meta: { current: { songId: 1 } } }))).toThrow(
      /songsterr page/i,
    );
  });

  it("explains itself when the payload is not valid json", () => {
    expect(() => extractStateMeta('<script id="state">{ broken</script>')).toThrow(
      /songsterr page/i,
    );
  });

  it("is not fooled by another script tag appearing first", () => {
    const html =
      '<script id="other">{"meta":{"current":{"songId":999}}}</script>' +
      pageWithState(validState());
    expect(extractStateMeta(html).songId).toBe(329);
  });
});

describe("buildRevisionUrl", () => {
  it("composes the cdn path for one part", () => {
    const meta = extractStateMeta(pageWithState(validState()));
    expect(buildRevisionUrl(meta, 1, "https://cdn.example")).toBe(
      "https://cdn.example/329/9446913/v0-3-2-abcdef/1.json",
    );
  });
});

describe("songIdFromTabUrl", () => {
  const at = (path: string) => `https://www.songsterr.com${path}`;

  it("reads the song id a tab url ends with", () => {
    expect(songIdFromTabUrl(at("/a/wsa/a-band-a-song-tab-s296"))).toBe(296);
  });

  it("reads it past a track selector", () => {
    // Picking a track in the player appends t<trackId> to the song id.
    expect(songIdFromTabUrl(at("/a/wsa/a-band-a-song-tab-s296t297"))).toBe(296);
  });

  it("reads it from a chords url too", () => {
    expect(songIdFromTabUrl(at("/a/wsa/a-band-a-song-chords-s296"))).toBe(296);
  });

  it("is null for a songsterr page that is not one song", () => {
    // The case this exists for: these pages carry a default state payload
    // for an unrelated song, which would otherwise import silently.
    expect(songIdFromTabUrl(at("/favorites"))).toBeNull();
    expect(songIdFromTabUrl(at("/"))).toBeNull();
  });

  it("does not take a song id out of the query string", () => {
    // Only the final url after redirects is ever checked, and that form
    // always carries the id in the path.
    expect(songIdFromTabUrl(at("/a/wa/song?id=296"))).toBeNull();
  });
});
