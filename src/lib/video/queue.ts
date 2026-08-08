// A minimal in-process queue that runs at most `limit` tasks concurrently.
// Each added task's promise resolves/rejects with the task's own outcome; a
// rejected task frees its slot so the queue keeps draining.
export function createConcurrencyQueue(limit: number) {
  let active = 0;
  const pending: Array<() => void> = [];

  const pump = () => {
    while (active < limit && pending.length > 0) {
      active++;
      const start = pending.shift()!;
      start();
    }
  };

  return {
    add(task: () => Promise<void>): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pending.push(() => {
          task().then(resolve, reject).finally(() => {
            active--;
            pump();
          });
        });
        pump();
      });
    },
  };
}
