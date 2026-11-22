import "server-only";

// Small in-memory cache for work that's the same for every visitor for a short while (home page rows,
// card lists). Per server instance; entries expire after `ms`. Concurrent callers share one computation.
const g = globalThis as unknown as { __memo?: Map<string, { at: number; v: Promise<unknown> }> };
const store = (g.__memo ??= new Map());

export function memo<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.v as Promise<T>;
  const v = fn().catch((e) => { store.delete(key); throw e; });
  store.set(key, { at: Date.now(), v });
  if (store.size > 500) for (const [k, x] of store) if (Date.now() - x.at > 600_000) store.delete(k);
  return v;
}
