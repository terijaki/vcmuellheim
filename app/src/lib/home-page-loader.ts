/** Fresh snapshots are returned immediately. Older ones are returned while a refresh runs. */
export const HOME_PAGE_CACHE_TTL_MS = 30_000;

/**
 * Cold reads must not hold the document. Past this budget the shell renders and
 * sections load on the client; the in-flight read still fills the cache.
 */
export const HOME_PAGE_LOADER_BUDGET_MS = 200;

export type HomePageSnapshot<T> = {
  value: T;
  storedAt: number;
};

export async function resolveHomePageLoader<T>(options: {
  load: () => Promise<T>;
  cache: HomePageSnapshot<T> | null;
  now: number;
  wait: (ms: number) => Promise<void>;
  store: (snapshot: HomePageSnapshot<T>) => void;
  budgetMs?: number;
  ttlMs?: number;
}): Promise<{ ready: true; data: T } | { ready: false }> {
  const ttlMs = options.ttlMs ?? HOME_PAGE_CACHE_TTL_MS;
  const budgetMs = options.budgetMs ?? HOME_PAGE_LOADER_BUDGET_MS;
  const age = options.cache ? options.now - options.cache.storedAt : Number.POSITIVE_INFINITY;
  const fresh = options.cache !== null && age < ttlMs;

  if (fresh && options.cache) {
    return { ready: true, data: options.cache.value };
  }

  const pending = options.load().then((value) => {
    options.store({ value, storedAt: Date.now() });
    return value;
  });

  if (options.cache) {
    pending.catch(() => {});
    return { ready: true, data: options.cache.value };
  }

  const winner = await Promise.race([
    pending.then((data) => ({ kind: "data" as const, data })),
    options.wait(budgetMs).then(() => ({ kind: "budget" as const })),
  ]);

  if (winner.kind === "budget") {
    pending.catch(() => {});
    return { ready: false };
  }

  return { ready: true, data: winner.data };
}
