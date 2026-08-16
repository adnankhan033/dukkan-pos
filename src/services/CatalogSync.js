import { invalidateDashboardCache } from "./DashboardCache";
import { invalidateInventoryCache } from "./InventoryCache";

export const CATALOG_CHANGED_EVENT = "dukkan-pos-catalog-changed";

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
