const DEFAULT_TTL_MS = 45_000;

let entry = null;
let refreshPromise = null;

export function getDashboardCacheEntry() {
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    entry = null;
    return null;
  }
  return entry.data;
}

export function setDashboardCache(data, ttlMs = DEFAULT_TTL_MS) {
  entry = {
    data,
    expiresAt: Date.now() + ttlMs,
  };
}

export function invalidateDashboardCache() {
  entry = null;
  refreshPromise = null;
}

export function isDashboardCacheFresh() {
  return getDashboardCacheEntry() != null;
}

/** Dedupe concurrent background refreshes. */
export function trackDashboardRefresh(promise) {
  refreshPromise = promise.finally(() => {
    if (refreshPromise === promise) refreshPromise = null;
  });
  return refreshPromise;
}

export function getDashboardRefreshPromise() {
  return refreshPromise;
}
