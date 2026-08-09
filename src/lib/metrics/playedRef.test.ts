import { describe, it, expect } from "vitest";
import { playedRefForItem, type TrackableItem } from "./playedRef";

describe("playedRefForItem", () => {
  it("maps a JamTrack (has pdfs) to jamTrackId", () => {
    expect(playedRefForItem({ id: "j1", pdfs: [] } as unknown as TrackableItem)).toEqual({
      trackId: null, jamTrackId: "j1", bookVideoId: null, videoId: null,
    });
  });
  it("maps a Video (has youtubeId) to videoId", () => {
    expect(playedRefForItem({ id: "v1", youtubeId: "abc" } as unknown as TrackableItem)).toEqual({
      trackId: null, jamTrackId: null, bookVideoId: null, videoId: "v1",
    });
  });
  it("maps a BookVideo (has filename) to bookVideoId", () => {
    expect(playedRefForItem({ id: "b1", filename: "x.mp4" } as unknown as TrackableItem)).toEqual({
      trackId: null, jamTrackId: null, bookVideoId: "b1", videoId: null,
    });
  });
  it("maps a plain Track to trackId", () => {
    expect(playedRefForItem({ id: "t1", title: "T" } as unknown as TrackableItem)).toEqual({
      trackId: "t1", jamTrackId: null, bookVideoId: null, videoId: null,
    });
  });
});
