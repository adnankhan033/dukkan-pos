/** Normalize supplier names for exact lookup keys. */
export function supplierLookupKey(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed.toLowerCase() : "";
}

/** Aggressive normalization for fuzzy comparison (keeps words like Trading). */
export function normalizeSupplierName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`"]/g, "")
    .replace(/[.,\-_/\\|&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }

  return prev[b.length];
}

export function supplierNameSimilarity(a, b) {
  const left = normalizeSupplierName(a);
  const right = normalizeSupplierName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const maxLen = Math.max(left.length, right.length);
  const distance = levenshteinDistance(left, right);
  let score = 1 - distance / maxLen;

  if (left.includes(right) || right.includes(left)) {
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    const containScore = shorter / longer;
    score = Math.max(score, containScore >= 0.65 ? containScore : 0);
  }

  return score;
}

const DEFAULT_FUZZY_THRESHOLD = 0.82;

/**
 * Find the best existing supplier for an import value.
 * @returns {{ id: number, company: string, type: 'exact'|'fuzzy', score: number } | null}
 */
export function findBestSupplierMatch(inputName, suppliers = [], { threshold = DEFAULT_FUZZY_THRESHOLD } = {}) {
  const raw = String(inputName ?? "").trim();
  if (!raw) return null;

  const inputKey = supplierLookupKey(raw);
  const inputNorm = normalizeSupplierName(raw);
  if (!inputNorm) return null;

  let best = null;

  for (const supplier of suppliers) {
    const company = String(supplier.company ?? "").trim();
    if (!company) continue;

    const companyKey = supplierLookupKey(company);
    if (companyKey === inputKey) {
      return { id: supplier.id, company, type: "exact", score: 1 };
    }

    const score = supplierNameSimilarity(raw, company);
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: supplier.id, company, type: "fuzzy", score };
    }
  }

  return best;
}
