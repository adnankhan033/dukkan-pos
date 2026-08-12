import { query, queryOne } from "../database/connection";

const SALE_STATUSES = "('completed', 'partial_return', 'returned')";

function saleDateRangeClause(from, to, column = "created_at") {
  return {
    clause: `AND date(${column}) >= date($1) AND date(${column}) <= date($2)`,
    params: [from, to],
  };
}

/** Shared net revenue / COGS / profit calculations (returns-aware). */
export async function getGrossSalesInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to);
  const row = await queryOne(
    `SELECT COALESCE(SUM(total), 0) AS total FROM sales
     WHERE status IN ${SALE_STATUSES} ${clause}`,
    params
  );
  return Number(row?.total ?? 0);
}

export async function getReturnsTotalInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to);
  const row = await queryOne(
    `SELECT COALESCE(SUM(total_refund), 0) AS total FROM sale_returns
     WHERE 1=1 ${clause}`,
    params
  );
  return Number(row?.total ?? 0);
}

export async function getNetRevenueInRange(from, to) {
  const gross = await getGrossSalesInRange(from, to);
  const returns = await getReturnsTotalInRange(from, to);
  return Math.max(0, gross - returns);
}

export async function getGrossCogsInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to, "s.created_at");
  const row = await queryOne(
    `SELECT COALESCE(SUM(si.quantity * p.cost_price), 0) AS total
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     JOIN products p ON si.product_id = p.id
     WHERE s.status IN ${SALE_STATUSES} ${clause}`,
    params
  );
  return Number(row?.total ?? 0);
}

export async function getReturnCogsInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to, "sr.created_at");
  const row = await queryOne(
    `SELECT COALESCE(SUM(sri.quantity * p.cost_price), 0) AS total
     FROM sale_return_items sri
     JOIN sale_returns sr ON sr.id = sri.return_id
     JOIN products p ON p.id = sri.product_id
     WHERE 1=1 ${clause}`,
    params
  );
  return Number(row?.total ?? 0);
}

export async function getNetCogsInRange(from, to) {
  const gross = await getGrossCogsInRange(from, to);
  const returned = await getReturnCogsInRange(from, to);
  return Math.max(0, gross - returned);
}

export async function getReturnsInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to, "sr.created_at");
  return query(
    `SELECT sr.*, s.sale_number, c.name AS customer_name
     FROM sale_returns sr
     JOIN sales s ON s.id = sr.sale_id
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE 1=1 ${clause}
     ORDER BY sr.created_at DESC`,
    params
  );
}

export async function getSalesCountInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to);
  const row = await queryOne(
    `SELECT COUNT(*) AS count FROM sales
     WHERE status IN ${SALE_STATUSES} ${clause}`,
    params
  );
  return Number(row?.count ?? 0);
}

export async function getReturnsCountInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to);
  const row = await queryOne(
    `SELECT COUNT(*) AS count FROM sale_returns WHERE 1=1 ${clause}`,
    params
  );
  return Number(row?.count ?? 0);
}

export async function getMonthlyGrossSales() {
  const row = await queryOne(
    `SELECT COALESCE(SUM(total), 0) AS total FROM sales
     WHERE status IN ${SALE_STATUSES}
     AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
  );
  return Number(row?.total ?? 0);
}

export async function getMonthlyReturnsTotal() {
  const row = await queryOne(
    `SELECT COALESCE(SUM(total_refund), 0) AS total FROM sale_returns
     WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
  );
  return Number(row?.total ?? 0);
}

export async function getMonthlyNetRevenue() {
  const gross = await getMonthlyGrossSales();
  const returns = await getMonthlyReturnsTotal();
  return Math.max(0, gross - returns);
}

export async function getMonthlyGrossCogs() {
  const row = await queryOne(
    `SELECT COALESCE(SUM(si.quantity * p.cost_price), 0) AS total
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     JOIN products p ON si.product_id = p.id
     WHERE s.status IN ${SALE_STATUSES}
     AND strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')`
  );
  return Number(row?.total ?? 0);
}

export async function getMonthlyReturnCogs() {
  const row = await queryOne(
    `SELECT COALESCE(SUM(sri.quantity * p.cost_price), 0) AS total
     FROM sale_return_items sri
     JOIN sale_returns sr ON sr.id = sri.return_id
     JOIN products p ON p.id = sri.product_id
     WHERE strftime('%Y-%m', sr.created_at) = strftime('%Y-%m', 'now')`
  );
  return Number(row?.total ?? 0);
}

export async function getMonthlyNetCogs() {
  const gross = await getMonthlyGrossCogs();
  const returned = await getMonthlyReturnCogs();
  return Math.max(0, gross - returned);
}

export async function getTodayGrossSales() {
  const row = await queryOne(
    `SELECT COALESCE(SUM(total), 0) AS total FROM sales
     WHERE status IN ${SALE_STATUSES}
     AND date(created_at) = date('now')`
  );
  return Number(row?.total ?? 0);
}

export async function getTodayReturnsTotal() {
  const row = await queryOne(
    `SELECT COALESCE(SUM(total_refund), 0) AS total FROM sale_returns
     WHERE date(created_at) = date('now')`
  );
  return Number(row?.total ?? 0);
}

export async function getTodayNetSales() {
  return Math.max(0, (await getTodayGrossSales()) - (await getTodayReturnsTotal()));
}

export async function getMonthlyReturns() {
  return query(
    `SELECT sr.*, s.sale_number, c.name AS customer_name
     FROM sale_returns sr
     JOIN sales s ON s.id = sr.sale_id
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE strftime('%Y-%m', sr.created_at) = strftime('%Y-%m', 'now')
     ORDER BY sr.created_at DESC`
  );
}
