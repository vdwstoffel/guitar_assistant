import { describe, it, expect } from "vitest";
import { fetchSongsterrScore } from "./fetchScore";

const TAB_URL = "https://www.songsterr.com/a/wsa/a-band-a-song-tab-s329";
const HOSTS = ["https://cdn-one.example", "https://cdn-two.example"];

function pageHtml(tracks: unknown[]): string {
  const state = {
    meta: {
      current: {
        songId: 329,
        revisionId: 9446913,
        image: "img",
        title: "A Song",
        artist: "A Band",
        tracks,
      },
    },
  };
  return `<html><body><script id="state">${JSON.stringify(state)}</script></body></html>`;
}

/**
 * A stand-in for the network.
 *
 * `parts` maps "<host>/<partId>" to the status that host gives that part, so
 * a test can say "the first CDN refuses everything" without caring how the
 * requests are shaped.
 */
function fakeFetch(opts: {
  html?: string;
  pageStatus?: number;
  finalUrl?: string;
  partStatus?: (host: string, partId: number) => number;
  onCall?: (url: string) => void;
}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    opts.onCall?.(url);

    if (new URL(url).hostname.endsWith("songsterr.com")) {
      const status = opts.pageStatus ?? 200;
      const response = new Response(status === 200 ? (opts.html ?? pageHtml([{ partId: 0 }])) : "", {
        status,
      });
      // Where the request actually ended up, which is where the song id is
      // read from; `Response.url` is otherwise empty for a constructed one.
      Object.defineProperty(response, "url", { value: opts.finalUrl ?? TAB_URL });
      return response;
    }

    const host = HOSTS.find((h) => url.startsWith(h))!;
    const partId = Number(url.split("/").pop()!.replace(".json", ""));
    const status = opts.partStatus?.(host, partId) ?? 200;
    if (status !== 200) return new Response("", { status });
    return Response.json({ partId, measures: [] });
  }) as typeof fetch;
}

describe("fetchSongsterrScore", () => {
  it("returns every part, in partId order", async () => {
    const score = await fetchSongsterrScore(TAB_URL, {
      cdnHosts: HOSTS,
      fetchImpl: fakeFetch({ html: pageHtml([{ partId: 2 }, { partId: 0 }, { partId: 1 }]) }),
    });

    expect(score.meta.title).toBe("A Song");
    expect(score.revisions.map((r) => r.trackMeta.partId)).toEqual([0, 1, 2]);
    expect(score.missingPartIds).toEqual([]);
  });

  it("keeps the parts it can get when the CDN refuses one", async () => {
    // A tab whose vocal part is missing is still worth practising; dropping
    // the whole import because one part 404s would be the wrong trade.
    const score = await fetchSongsterrScore(TAB_URL, {
      cdnHosts: HOSTS,
      fetchImpl: fakeFetch({
        html: pageHtml([{ partId: 0 }, { partId: 1 }]),
        partStatus: (_host, partId) => (partId === 1 ? 404 : 200),
      }),
    });

    expect(score.revisions.map((r) => r.trackMeta.partId)).toEqual([0]);
    expect(score.missingPartIds).toEqual([1]);
  });

  it("falls back to the second CDN host when the first yields nothing", async () => {
    const tried: string[] = [];
    const score = await fetchSongsterrScore(TAB_URL, {
      cdnHosts: HOSTS,
      fetchImpl: fakeFetch({
        html: pageHtml([{ partId: 0 }]),
        partStatus: (host) => (host === HOSTS[0] ? 403 : 200),
        onCall: (url) => tried.push(url),
      }),
    });

    expect(score.revisions).toHaveLength(1);
    expect(score.missingPartIds).toEqual([]);
    expect(tried.some((u) => u.startsWith(HOSTS[0]))).toBe(true);
    expect(tried.some((u) => u.startsWith(HOSTS[1]))).toBe(true);
  });

  it("does not try the second host when the first already worked", async () => {
    const tried: string[] = [];
    await fetchSongsterrScore(TAB_URL, {
      cdnHosts: HOSTS,
      fetchImpl: fakeFetch({ html: pageHtml([{ partId: 0 }]), onCall: (u) => tried.push(u) }),
    });

    expect(tried.some((u) => u.startsWith(HOSTS[1]))).toBe(false);
  });

  it("ignores tracks that carry no part id", async () => {
    const score = await fetchSongsterrScore(TAB_URL, {
      cdnHosts: HOSTS,
      fetchImpl: fakeFetch({ html: pageHtml([{ partId: 0 }, { name: "no part id" }]) }),
    });

    expect(score.revisions).toHaveLength(1);
  });

  it("explains itself when the tab page cannot be fetched", async () => {
    await expect(
      fetchSongsterrScore(TAB_URL, {
        cdnHosts: HOSTS,
        fetchImpl: fakeFetch({ pageStatus: 404 }),
      }),
    ).rejects.toThrow(/songsterr/i);
  });

  it("explains itself when no part could be retrieved at all", async () => {
    await expect(
      fetchSongsterrScore(TAB_URL, {
        cdnHosts: HOSTS,
        fetchImpl: fakeFetch({ partStatus: () => 403 }),
      }),
    ).rejects.toThrow(/could not download/i);
  });

  it("refuses a url that is not a songsterr link, without fetching", async () => {
    let called = false;
    await expect(
      fetchSongsterrScore("https://example.com/x", {
        cdnHosts: HOSTS,
        fetchImpl: fakeFetch({ onCall: () => (called = true) }),
      }),
    ).rejects.toThrow(/songsterr/i);
    expect(called).toBe(false);
  });

  it("refuses a songsterr page that is not one song's tab", async () => {
    // Songsterr answers its home page, favourites and search with a default
    // state payload for an unrelated popular song. Taking that at face value
    // imports a song nobody asked for, and looks like success doing it.
    await expect(
      fetchSongsterrScore(TAB_URL, {
        cdnHosts: HOSTS,
        fetchImpl: fakeFetch({ finalUrl: "https://www.songsterr.com/favorites" }),
      }),
    ).rejects.toThrow(/tab/i);
  });

  it("refuses a page whose state is about a different song than the link", async () => {
    await expect(
      fetchSongsterrScore(TAB_URL, {
        cdnHosts: HOSTS,
        fetchImpl: fakeFetch({
          html: pageHtml([{ partId: 0 }]), // songId 329
          finalUrl: "https://www.songsterr.com/a/wsa/something-else-tab-s27",
        }),
      }),
    ).rejects.toThrow(/different song/i);
  });

  it("accepts the page the link redirected to, when it is the same song", async () => {
    // The older ?id= links redirect to the canonical tab url; that is a
    // normal import, not a mismatch.
    const score = await fetchSongsterrScore("https://songsterr.com/a/wa/song?id=329", {
      cdnHosts: HOSTS,
      fetchImpl: fakeFetch({ html: pageHtml([{ partId: 0 }]), finalUrl: TAB_URL }),
    });
    expect(score.revisions).toHaveLength(1);
  });
});
