// Lightweight in-memory cache to avoid empty/skeleton flicker when navigating
// back to a page whose data was already loaded in this session.
const store = new Map<string, any>();

export const pageCache = {
  get<T = any>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  },
  set<T = any>(key: string, value: T) {
    store.set(key, value);
  },
  has(key: string) {
    return store.has(key);
  },
  clear(prefix?: string) {
    if (!prefix) return store.clear();
    for (const k of Array.from(store.keys())) {
      if (k.startsWith(prefix)) store.delete(k);
    }
  },
};
