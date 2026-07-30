import type { BackingTrack } from "@/types";

/** Progress event shape emitted by the streaming download endpoints. */
export interface DownloadProgressEvent {
  /** 0–100 while downloading; null during ffmpeg conversion. */
  percent: number | null;
  phase: "downloading" | "converting";
}

/**
 * Consume an NDJSON download-progress stream from a backing-track endpoint.
 *
 * The server emits one JSON object per line:
 *   {"type":"progress","percent":42,"phase":"downloading"}
 *   {"type":"progress","percent":null,"phase":"converting"}
 *   {"type":"done","track":{...}} | {"type":"error","error":"..."}
 *
 * Calls `onProgress` for each progress line and resolves with the created/updated
 * track on `done`. Throws with the server's message on an `error` line, or if the
 * stream ends without a terminal event.
 */
export async function consumeDownloadStream(
  res: Response,
  onProgress: (e: DownloadProgressEvent) => void,
): Promise<BackingTrack> {
  if (!res.body) throw new Error("Download stream had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: BackingTrack | null = null;
  let errorMsg: string | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const msg = JSON.parse(trimmed) as
      | { type: "progress"; percent: number | null; phase: "downloading" | "converting" }
      | { type: "done"; track: BackingTrack }
      | { type: "error"; error: string };
    if (msg.type === "progress") onProgress({ percent: msg.percent, phase: msg.phase });
    else if (msg.type === "done") result = msg.track;
    else if (msg.type === "error") errorMsg = msg.error;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      handleLine(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  }
  if (buffer.trim()) handleLine(buffer);

  if (errorMsg) throw new Error(errorMsg);
  if (!result) throw new Error("Download ended unexpectedly");
  return result;
}
