import { useSettingsStore } from "../contexts/store";
import { useAuthStore } from "../contexts/store";
import { settingsService } from "../services/SettingsService";
import { isDrupalConfigured, resolveApiBaseUrl } from "./apiConfig";

export async function getAppSettings() {
  const cached = useSettingsStore.getState().settings;
  if (cached && Object.keys(cached).length > 0) {
    return cached;
  }
  return settingsService.getAll();
}

/** True when backend URL is saved and the user has an active Drupal JWT. */
export async function isDrupalMode() {
  const settings = await getAppSettings();
  if (!isDrupalConfigured(settings)) {
    return false;
  }
  return Boolean(useAuthStore.getState().token);
}

export function isDrupalConfiguredInStore() {
  return isDrupalConfigured(useSettingsStore.getState().settings);
}

export function getResolvedBackendUrl() {
  return resolveApiBaseUrl(useSettingsStore.getState().settings);
}

/** Normalize Drupal product row for UI (matches SQLite shape). */
export function normalizeProduct(row) {
  if (!row) return row;
  const createdByName = row.created_by_name ?? row.creator_name ?? null;
  const createdByUsername = row.created_by_username ?? row.creator_username ?? null;
  return {
    ...row,
    id: Number(row.id),
    category_id: row.category_id != null ? Number(row.category_id) : null,
    unit_id: row.unit_id != null ? Number(row.unit_id) : null,
    created_by: row.created_by != null ? Number(row.created_by) : null,
    cost_price: Number(row.cost_price ?? 0),
    selling_price: Number(row.selling_price ?? 0),
    quantity: Number(row.quantity ?? 0),
    min_stock: Number(row.min_stock ?? 0),
    published: Number(row.published ?? 1),
    has_image: row.image ? 1 : 0,
    created_by_label:
      createdByName?.trim() ||
      createdByUsername?.trim() ||
      null,
  };
}

export function normalizeSale(row) {
  if (!row) return row;
  const cashierName = row.cashier_name ?? null;
  const cashierUsername = row.cashier_username ?? null;
  return {
    ...row,
    id: Number(row.id),
    cashier_id: row.cashier_id != null ? Number(row.cashier_id) : null,
    terminal_id: row.terminal_id != null ? Number(row.terminal_id) : null,
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    vat: Number(row.vat ?? 0),
    total: Number(row.total ?? 0),
    item_count: row.item_count != null ? Number(row.item_count) : undefined,
    cashier_label:
      row.cashier_label ??
      (cashierName?.trim() ||
        cashierUsername?.trim() ||
        null),
    terminal_label:
      row.terminal_label ??
      (row.terminal_name?.trim() ||
        row.terminal_code?.trim() ||
        null),
    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          ...item,
          id: Number(item.id),
          sale_id: Number(item.sale_id),
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          discount: Number(item.discount ?? 0),
          total: Number(item.total),
        }))
      : [],
  };
}

export function normalizeUser(row) {
  if (!row) return row;
  return {
    ...row,
    id: Number(row.id),
    is_active: Number(row.is_active ?? 1),
  };
}

/** Map orders return filter to Drupal API query param. */
export function drupalReturnFilterParam(returnFilter) {
  if (!returnFilter || returnFilter === "all") return undefined;
  return returnFilter;
}

export function normalizeSaleReturn(row) {
  if (!row) return row;
  return {
    ...row,
    id: Number(row.id),
    sale_id: Number(row.sale_id),
    total_refund: Number(row.total_refund ?? 0),
  };
}

export function normalizeProcessReturnResult(result) {
  if (!result) return result;
  return {
    returnId: Number(result.return_id ?? result.returnId),
    returnNumber: result.return_number ?? result.returnNumber,
    totalRefund: Number(result.total_refund ?? result.totalRefund ?? 0),
    sale: normalizeSale(result.sale),
    returns: Array.isArray(result.returns)
      ? result.returns.map(normalizeSaleReturn)
      : [],
  };
}
