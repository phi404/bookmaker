/** Keep one running job and the newest pending job; stale work never forms a backlog. */
export function latestJob<T extends { revision: number }>(send: (job: T) => void): { submit(job: T): void; complete(revision: number): void; clear(): void } {
  let active: number | undefined, pending: T | undefined, newest = -1;
  const start = (job: T) => { active = job.revision; send(job); };
  return {
    submit(job) { if (job.revision <= newest) return; newest = job.revision; if (active === undefined) start(job); else pending = job; },
    complete(revision) { if (revision !== active) return; active = undefined; const next = pending; pending = undefined; if (next) start(next); },
    clear() { active = undefined; pending = undefined; },
  };
}
