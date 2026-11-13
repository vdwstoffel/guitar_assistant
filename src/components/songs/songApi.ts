import { createKeyedQueues } from "@/lib/songwriting/serialQueue";
import type { SectionInput } from "@/lib/songwriting/songs";
import type { Composition, SongListItem } from "@/types";

/** The song is not on the server any more. */
export class SongGoneError extends Error {
  constructor() {
    super("This song was deleted");
    this.name = "SongGoneError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 404) throw new SongGoneError();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof body?.error === "string" ? body.error : `The server said ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const url = (id: string) => `/api/songs/${encodeURIComponent(id)}`;

export const listSongs = () => request<SongListItem[]>("/api/songs");
export const createSong = () => request<Composition>("/api/songs", json("POST", {}));
export const fetchSong = (id: string) => request<Composition>(url(id));
export const patchSong = (id: string, fields: { name?: string; lyrics?: string }) => request<Composition>(url(id), json("PATCH", fields));
export const deleteSong = (id: string) => request<void>(url(id), { method: "DELETE" });
/** Replaces the whole ordered section list. */
export const putSections = (id: string, sections: SectionInput[]) => request<Composition>(`${url(id)}/sections`, json("PUT", sections));

const songQueues = createKeyedQueues();

/** Run `job` after every read and write of this song queued before it, so responses land in the order the changes were made. */
export const inSongOrder = <T,>(songId: string, job: () => Promise<T>): Promise<T> => songQueues.run(songId, job);
