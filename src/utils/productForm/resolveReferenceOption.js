import {
  findBestSupplierMatch,
  supplierLookupKey,
  supplierNameSimilarity,
} from "../productImport/supplierMatch.js";

const FUZZY_THRESHOLD = 0.82;

export function findBestCategoryMatch(inputName, categories = []) {
  const trimmed = String(inputName ?? "").trim();
  if (!trimmed) return null;

  const key = supplierLookupKey(trimmed);
  for (const category of categories) {
    const name = String(category.name ?? "").trim();
    if (!name) continue;
    if (supplierLookupKey(name) === key) {
      return { id: category.id, label: name, type: "exact", score: 1 };
    }
  }

  let best = null;
  for (const category of categories) {
    const name = String(category.name ?? "").trim();
    if (!name) continue;
    const score = supplierNameSimilarity(trimmed, name);
    if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
      best = { id: category.id, label: name, type: "fuzzy", score };
    }
  }

  return best;
}

export function findBestUnitMatch(inputName, units = []) {
  const trimmed = String(inputName ?? "").trim();
  if (!trimmed) return null;

  const key = supplierLookupKey(trimmed);
  for (const unit of units) {
    const name = String(unit.name ?? "").trim();
    const symbol = String(unit.symbol ?? "").trim();
    if ((name && supplierLookupKey(name) === key) || (symbol && supplierLookupKey(symbol) === key)) {
      return { id: unit.id, label: name || symbol, type: "exact", score: 1 };
    }
  }

  let best = null;
  for (const unit of units) {
    const name = String(unit.name ?? "").trim();
    const symbol = String(unit.symbol ?? "").trim();
    const score = Math.max(
      name ? supplierNameSimilarity(trimmed, name) : 0,
      symbol ? supplierNameSimilarity(trimmed, symbol) : 0
    );
    if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
      best = { id: unit.id, label: name || symbol, type: "fuzzy", score };
    }
  }

  return best;
}

export function deriveUnitFields(label) {
  const trimmed = String(label ?? "").trim();
  if (!trimmed) return null;

  const symbol =
    trimmed.length <= 12
      ? trimmed.toLowerCase()
      : trimmed
          .split(/\s+/)
          .map((part) => part.charAt(0))
          .join("")
          .toLowerCase()
          .slice(0, 12) || trimmed.slice(0, 12).toLowerCase();

  return {
    name: trimmed,
    symbol,
  };
}

export { findBestSupplierMatch, FUZZY_THRESHOLD };
