const DEFAULT_TTL_MS = 45_000;

const listCache = new Map();
let summaryCache = null;

export function inventoryListCacheKey(filter, page, search = "") {
  return `${filter}:${page}:${search.trim().toLowerCase()}`;
}

export function getInventoryListCache(key) {
  const entry = listCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    listCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setInventoryListCache(key, data, ttlMs = DEFAULT_TTL_MS) {
  listCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function getInventorySummaryCache() {
  if (!summaryCache) return null;
  if (Date.now() > summaryCache.expiresAt) {
    summaryCache = null;
    return null;
  }
  return summaryCache.data;
}

export function setInventorySummaryCache(data, ttlMs = DEFAULT_TTL_MS) {
  summaryCache = { data, expiresAt: Date.now() + ttlMs };
}

export function invalidateInventoryCache() {
  listCache.clear();
  summaryCache = null;
}
