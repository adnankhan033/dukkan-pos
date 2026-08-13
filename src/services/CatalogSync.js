import { apiClient } from "../api/ApiClient";
import { invalidateDashboardCache } from "./DashboardCache";
import { invalidateInventoryCache } from "./InventoryCache";

export const CATALOG_CHANGED_EVENT = "dukkan-pos-catalog-changed";

const POLL_INTERVAL_MS = 15_000;

let knownRevision = null;
let pollTimer = null;
let pollInFlight = false;

export function getKnownCatalogRevision() {
  return knownRevision;
}

export function setKnownCatalogRevision(revision) {
  knownRevision = revision || null;
}

export function invalidateProductCaches() {
  invalidateInventoryCache();
  invalidateDashboardCache();
}

export function dispatchCatalogChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CATALOG_CHANGED_EVENT));
  }
}

export function onCatalogChanged(handler) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(CATALOG_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CATALOG_CHANGED_EVENT, handler);
}

/**
 * Compare server catalog revision; invalidate caches and notify UI when it changes.
 */
export async function syncCatalogRevision({ forceNotify = false } = {}) {
  const meta = await apiClient.getProductCatalogMeta();
  const revision = meta?.revision ?? null;
  const changed = knownRevision !== null && revision !== null && knownRevision !== revision;

  if (changed || forceNotify) {
    invalidateProductCaches();
    dispatchCatalogChanged();
  }

  knownRevision = revision;
  return meta;
}

export async function bootstrapCatalogRevision() {
  try {
    return await syncCatalogRevision();
  } catch {
    return null;
  }
}

function runCatalogSyncTick() {
  if (pollInFlight) return;
  pollInFlight = true;
  syncCatalogRevision()
    .catch(() => {})
    .finally(() => {
      pollInFlight = false;
    });
}

export function startCatalogSyncPolling() {
  stopCatalogSyncPolling();
  runCatalogSyncTick();
  pollTimer = setInterval(runCatalogSyncTick, POLL_INTERVAL_MS);
  if (typeof window !== "undefined") {
    window.addEventListener("focus", runCatalogSyncTick);
  }
}

export function stopCatalogSyncPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("focus", runCatalogSyncTick);
  }
}
