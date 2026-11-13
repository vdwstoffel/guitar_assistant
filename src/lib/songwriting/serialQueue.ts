/**
 * Async jobs run one at a time, in the order they were queued.
 *
 * Every write to a riff (a header edit, a tab autosave) and every read of it
 * goes through one queue per riff, so the server sees them in the order the
 * user made them and their responses come back in that order too: a later
 * response is never overwritten by an earlier one.
 */
export interface SerialQueue {
  /** Run `job` once every job queued before it has settled; resolves or rejects with it. */
  run<T>(job: () => Promise<T>): Promise<T>;
  /** Resolves once every job queued so far has settled. */
  idle(): Promise<void>;
}

const settled = () => undefined;

export function createSerialQueue(): SerialQueue {
  let tail: Promise<void> = Promise.resolve();
  return {
    run<T>(job: () => Promise<T>): Promise<T> {
      const result = tail.then(job);
      // A failed job does not stop the ones after it.
      tail = result.then(settled, settled);
      return result;
    },
    idle: () => tail,
  };
}

export interface KeyedQueues {
  run<T>(key: string, job: () => Promise<T>): Promise<T>;
  idle(key: string): Promise<void>;
  /** Keys with jobs still queued or running (a drained queue is dropped). */
  readonly size: number;
}

/** One serial queue per key, made on first use and dropped once it drains. */
export function createKeyedQueues(): KeyedQueues {
  const queues = new Map<string, { queue: SerialQueue; pending: number }>();
  return {
    run<T>(key: string, job: () => Promise<T>): Promise<T> {
      let entry = queues.get(key);
      if (!entry) {
        entry = { queue: createSerialQueue(), pending: 0 };
        queues.set(key, entry);
      }
      const e = entry;
      e.pending++;
      const done = () => {
        e.pending--;
        if (e.pending === 0 && queues.get(key) === e) queues.delete(key);
      };
      const result = e.queue.run(job);
      result.then(done, done);
      return result;
    },
    idle: (key) => queues.get(key)?.queue.idle() ?? Promise.resolve(),
    get size() {
      return queues.size;
    },
  };
}
