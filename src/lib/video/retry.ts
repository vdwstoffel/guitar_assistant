// Run an async function, retrying on rejection up to `attempts` total tries.
// Returns the first success; rethrows the last error if every attempt fails.
// Used to survive transient yt-dlp/googlevideo failures (e.g. intermittent
// HTTP 403 mid-download) that succeed on a fresh attempt.
export async function retryAsync<T>(
  fn: () => Promise<T>,
  attempts: number,
  opts: { delayMs?: number; onRetry?: (err: unknown, attempt: number) => void } = {},
): Promise<T> {
  const { delayMs = 0, onRetry } = opts;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        onRetry?.(err, attempt);
        if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}
