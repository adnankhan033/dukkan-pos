import { query, queryOne } from "../database/connection";
import { isPayLaterMethod } from "../utils/paymentMethods";

const SALE_STATUSES = "('completed', 'partial_return', 'returned')";

function saleDateRangeClause(from, to, column = "created_at") {
  return {
    clause: `AND date(${column}) >= date($1) AND date(${column}) <= date($2)`,
    params: [from, to],
  };
}

export function classifyPaymentMethod(method, collectCashCodes = null) {
  const key = String(method || "cash").toLowerCase();
  if (isPayLaterMethod(key) || key === "credit") return "credit";
  const cashCodes = collectCashCodes instanceof Set && collectCashCodes.size
    ? collectCashCodes
    : new Set(["cash"]);
  if (key === "cash" || cashCodes.has(key)) return "cash";
  if (key === "card" || key === "transfer" || key === "bank") return "card";
  return "other";
}

async function loadCollectCashCodes() {
  try {
    const rows = await query("SELECT code, collect_cash FROM payment_methods");
    const codes = new Set(
      (rows || [])
        .filter((row) => Number(row.collect_cash) === 1)
        .map((row) => String(row.code || "").toLowerCase())
        .filter(Boolean)
    );
    codes.add("cash");
    return codes;
  } catch {
    return new Set(["cash"]);
  }
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

export async function getSalesExVatInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to);
  const row = await queryOne(
    `SELECT COALESCE(SUM(COALESCE(total, 0) - COALESCE(vat, 0)), 0) AS total FROM sales
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

export async function getReturnsExVatInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to, "sr.created_at");
  const row = await queryOne(
    `SELECT COALESCE(SUM(
       CASE
         WHEN COALESCE(s.total, 0) <= 0 THEN sr.total_refund
         ELSE sr.total_refund * ((s.total - COALESCE(s.vat, 0)) / s.total)
       END
     ), 0) AS total
     FROM sale_returns sr
     JOIN sales s ON s.id = sr.sale_id
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
    `SELECT COALESCE(SUM(si.quantity * COALESCE(si.cost_price, p.cost_price)), 0) AS total
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
    `SELECT COALESCE(SUM(
       sri.quantity * COALESCE(
         (SELECT si.cost_price FROM sale_items si
          WHERE si.sale_id = sr.sale_id AND si.product_id = sri.product_id
          LIMIT 1),
         p.cost_price
       )
     ), 0) AS total
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

export async function getExpensesTotalInRange(from, to) {
  const row = await queryOne(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
     WHERE date(expense_date) >= date($1) AND date(expense_date) <= date($2)`,
    [from, to]
  );
  return Number(row?.total ?? 0);
}

export async function getExpenseBreakdownInRange(from, to) {
  return query(
    `SELECT category AS id, COALESCE(SUM(amount), 0) AS balance
     FROM expenses
     WHERE date(expense_date) >= date($1) AND date(expense_date) <= date($2)
     GROUP BY category
     HAVING COALESCE(SUM(amount), 0) > 0
     ORDER BY balance DESC`,
    [from, to]
  );
}

/** Operational profit from POS sales, returns, COGS, and expenses — shared by dashboard, reports, and accounting. VAT is tax, not profit. */
export async function getProfitInRange(from, to) {
  const [salesInclusive, returnsInclusive, salesEx, returnsEx, cogs, expenses] = await Promise.all([
    getGrossSalesInRange(from, to),
    getReturnsTotalInRange(from, to),
    getSalesExVatInRange(from, to),
    getReturnsExVatInRange(from, to),
    getNetCogsInRange(from, to),
    getExpensesTotalInRange(from, to),
  ]);
  const sales = Number(salesEx) || 0;
  const salesReturns = Number(returnsEx) || 0;
  const netRevenue = Math.max(0, sales - salesReturns);
  const cogsValue = Number(cogs) || 0;
  const expensesValue = Number(expenses) || 0;
  const grossProfit = netRevenue - cogsValue;
  const netProfit = grossProfit - expensesValue;
  return {
    sales,
    salesInclusive: Number(salesInclusive) || 0,
    salesReturns,
    salesReturnsInclusive: Number(returnsInclusive) || 0,
    otherIncome: 0,
    discounts: 0,
    netRevenue,
    netRevenueInclusive: Math.max(0, (Number(salesInclusive) || 0) - (Number(returnsInclusive) || 0)),
    cogs: cogsValue,
    expenses: expensesValue,
    grossProfit,
    netProfit,
  };
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
    `SELECT COALESCE(SUM(si.quantity * COALESCE(si.cost_price, p.cost_price)), 0) AS total
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
    `SELECT COALESCE(SUM(
       sri.quantity * COALESCE(
         (SELECT si.cost_price FROM sale_items si
          WHERE si.sale_id = sr.sale_id AND si.product_id = sri.product_id
          LIMIT 1),
         p.cost_price
       )
     ), 0) AS total
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

/** Sales totals grouped by payment method for a date range. */
export async function getPaymentBreakdownInRange(from, to) {
  const collectCashCodes = await loadCollectCashCodes();
  const { clause, params } = saleDateRangeClause(from, to);
  const rows = await query(
    `SELECT payment_method,
            COUNT(*) AS sale_count,
            COALESCE(SUM(total), 0) AS gross_total
     FROM sales
     WHERE status IN ${SALE_STATUSES} ${clause}
     GROUP BY payment_method`,
    params
  );

  const breakdown = {
    cash: { count: 0, gross: 0, returns: 0, net: 0 },
    card: { count: 0, gross: 0, returns: 0, net: 0 },
    credit: { count: 0, gross: 0, returns: 0, net: 0 },
    other: { count: 0, gross: 0, returns: 0, net: 0 },
  };
  for (const row of rows) {
    const method = classifyPaymentMethod(row.payment_method, collectCashCodes);
    breakdown[method].count += Number(row.sale_count ?? 0);
    breakdown[method].gross += Number(row.gross_total ?? 0);
  }

  const { clause: retClause, params: retParams } = saleDateRangeClause(from, to, "sr.created_at");
  let returnRows = [];
  try {
    returnRows = await query(
      `SELECT s.payment_method, COALESCE(SUM(sr.total_refund), 0) AS refund_total
       FROM sale_returns sr
       JOIN sales s ON s.id = sr.sale_id
       WHERE 1=1 ${retClause}
       GROUP BY s.payment_method`,
      retParams
    );
  } catch {
    returnRows = [];
  }

  for (const row of returnRows) {
    const key = classifyPaymentMethod(row.payment_method, collectCashCodes);
    breakdown[key].returns += Number(row.refund_total ?? 0);
  }

  for (const key of ["cash", "card", "credit", "other"]) {
    breakdown[key].net = Math.max(0, breakdown[key].gross - breakdown[key].returns);
  }

  return breakdown;
}

export async function getHeldOrdersCountInRange(from, to) {
  const { clause, params } = saleDateRangeClause(from, to);
  const row = await queryOne(
    `SELECT COUNT(*) AS count FROM sales WHERE status = 'held' ${clause}`,
    params
  );
  return Number(row?.count ?? 0);
}
