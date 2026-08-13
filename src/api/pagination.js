/**
 * Fetch all pages from a paginated Drupal API list endpoint.
 * @param {(page: number) => Promise<{ items?: unknown[], total?: number }>} fetchPage
 * @param {{ pageSize?: number, maxPages?: number }} options
 */
export async function fetchAllPages(fetchPage, { pageSize = 200, maxPages = 50 } = {}) {
  const items = [];
  let page = 1;
  let total = Infinity;

  while (page <= maxPages && items.length < total) {
    const result = await fetchPage(page);
    const batch = result.items || [];
    total = Number(result.total ?? batch.length);
    items.push(...batch);
    if (batch.length < pageSize || items.length >= total) break;
    page += 1;
  }

  return items;
}

/** Slice an in-memory list for UI pagination. */
export function paginateList(items, page = 1, limit = 10) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 10);
  const start = (safePage - 1) * safeLimit;
  return {
    items: items.slice(start, start + safeLimit),
    total: items.length,
    page: safePage,
    limit: safeLimit,
  };
}
