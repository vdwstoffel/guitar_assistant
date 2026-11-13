import { createKeyedQueues } from "@/lib/songwriting/serialQueue";
import type { RiffPatch } from "@/lib/songwriting/riffs";
import type { PartMix } from "@/lib/songwriting/riffMix";
import type { Riff, RiffPart, RiffSummary } from "@/types";

/** The riff (or its part) is not on the server any more: someone deleted it. */
export class RiffGoneError extends Error {
  constructor() {
    super("This riff was deleted");
    this.name = "RiffGoneError";
  }
}

/**
 * The part is not on the server any more (deleted here or in another tab),
 * though its riff is: `riff` is the riff as it is now.
 */
export class PartGoneError extends Error {
  constructor(readonly riff: Riff) {
    super("This part was deleted");
    this.name = "PartGoneError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 404) throw new RiffGoneError();
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

export const listRiffs = () => request<RiffSummary[]>("/api/riffs");
export const fetchRiff = (id: string) => request<Riff>(`/api/riffs/${encodeURIComponent(id)}`);
export const patchRiff = (id: string, fields: RiffPatch) => request<Riff>(`/api/riffs/${encodeURIComponent(id)}`, json("PATCH", fields));
export const deleteRiff = (id: string) => request<void>(`/api/riffs/${encodeURIComponent(id)}`, { method: "DELETE" });

/** What a part PATCH may change. */
export type PartPatch = {
  alphatex?: string;
  playbackSpeed?: number;
  name?: string;
  trimStart?: number;
  trimEnd?: number;
} & PartMix;

const partUrl = (riffId: string, partId: string) =>
  `/api/riffs/${encodeURIComponent(riffId)}/parts/${encodeURIComponent(partId)}`;

/**
 * A request about one part. A 404 means the part or its whole riff is gone,
 * and only the riff can say which: PartGoneError (with the riff as it is) when
 * the riff is still there, RiffGoneError when it is not.
 */
async function partRequest<T>(riffId: string, url: string, init: RequestInit): Promise<T> {
  try {
    return await request<T>(url, init);
  } catch (err) {
    if (!(err instanceof RiffGoneError)) throw err;
    throw new PartGoneError(await fetchRiff(riffId));
  }
}

export const patchPart = (riffId: string, partId: string, body: PartPatch) =>
  partRequest<{ part: RiffPart; riff: Riff }>(riffId, partUrl(riffId, partId), json("PATCH", body));
/** A new part, named and placed last by the server (ruling 4). */
export const addPart = (riffId: string, kind: RiffPart["kind"]) =>
  request<{ part: RiffPart; riff: Riff }>(`/api/riffs/${encodeURIComponent(riffId)}/parts`, json("POST", { kind }));
/** Refused (400) for the riff's last part (ruling 5). */
export const deletePart = (riffId: string, partId: string) =>
  partRequest<void>(riffId, partUrl(riffId, partId), { method: "DELETE" });

/** The part's new take, replacing the one it had. */
export function postTake(
  riffId: string,
  partId: string,
  take: { blob: Blob; mimeType: string },
  meta: { trimStart: number; trimEnd: number; audioDuration: number },
) {
  const body = new FormData();
  body.append("file", take.blob.type ? take.blob : new Blob([take.blob], { type: take.mimeType }), "take");
  body.append("meta", JSON.stringify(meta));
  return partRequest<{ part: RiffPart; riff: Riff }>(riffId, `${partUrl(riffId, partId)}/take`, { method: "POST", body });
}

const riffQueues = createKeyedQueues();

/**
 * Run `job` after every read and write of this riff queued before it. The
 * header form, the tab editor's autosave (its unmount flush included) and
 * loading the riff all go through here, so the server applies them in the
 * order they were made and each response lands after the ones before it.
 * Put the state update inside `job`: once `riffSettled` resolves it has run.
 */
export function inRiffOrder<T>(riffId: string, job: () => Promise<T>): Promise<T> {
  return riffQueues.run(riffId, job);
}

/** Resolves once every read and write of this riff queued so far has finished. */
export function riffSettled(riffId: string): Promise<void> {
  return riffQueues.idle(riffId);
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
