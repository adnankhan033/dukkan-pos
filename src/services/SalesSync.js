/** Notifies UI (Orders, Dashboard) when sales are created, updated, or deleted. */
export const SALES_CHANGED_EVENT = "dukkan-pos-sales-changed";

export function dispatchSalesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SALES_CHANGED_EVENT));
  }
}

export function onSalesChanged(handler) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(SALES_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SALES_CHANGED_EVENT, handler);
}
