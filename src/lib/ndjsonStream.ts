export type NdjsonSend = (obj: unknown) => void;

/**
 * Build a streaming NDJSON `Response`: `run` receives a `send` function that
 * enqueues one JSON object per line. The stream closes when `run` settles.
 * Errors thrown inside `run` should be sent as a final `{type:"error"}` line
 * by the caller before returning (the stream cannot change HTTP status once open).
 */
export function ndjsonStreamResponse(run: (send: NdjsonSend) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: NdjsonSend = (obj) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        await run(send);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
