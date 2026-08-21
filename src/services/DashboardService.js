import { query, queryOne } from "../database/connection";
import { saleService } from "./SaleService";
import { purchaseService } from "./PurchaseService";
import { productService } from "./ProductService";
import { customerService } from "./CustomerService";
import { supplierService } from "./SupplierService";
import { employeeService } from "./EmployeeService";
import {
  getGrossSalesInRange,
  getNetRevenueInRange,
  getProfitInRange,
  getReturnsTotalInRange,
} from "./FinanceService";
import { dashboardInsightsService } from "./DashboardInsightsService";
import {
  getDashboardCacheEntry,
  setDashboardCache,
  trackDashboardRefresh,
} from "./DashboardCache";
import { useSettingsStore } from "../contexts/store";
import { getBusinessDateISO, getBusinessPeriodDateRange } from "../utils/businessDate";

function shiftBusinessDateISO(iso, daysBack) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d - daysBack);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getWeeklySalesTrend(settings) {
  const anchor = getBusinessDateISO(settings);
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = shiftBusinessDateISO(anchor, i);
    const [y, m, d] = date.split("-").map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short" });
    const total = await getNetRevenueInRange(date, date);
    days.push({ date, label, total });
  }
  return days;
}

function computeTodayTrend(todaySales, weeklyTrend) {
  const previous = weeklyTrend.slice(0, -1);
  if (!previous.length) return null;
  const avg =
    previous.reduce((sum, day) => sum + day.total, 0) / previous.length;
  if (avg <= 0) return todaySales > 0 ? 100 : null;
  return Math.round(((todaySales - avg) / avg) * 100);
}

async function moneyByMethod(table, dateCol, amountCol, date, extraWhere = "") {
  const rows = await query(
    `SELECT lower(coalesce(payment_method, 'cash')) AS method,
            COALESCE(SUM(${amountCol}), 0) AS total
     FROM ${table}
     WHERE date(${dateCol}) = date($1) ${extraWhere}
     GROUP BY lower(coalesce(payment_method, 'cash'))`,
    [date]
  );
  const out = { cash: 0, card: 0, credit: 0, other: 0 };
  for (const row of rows) {
    const method = String(row.method || "cash");
    const value = Number(row.total || 0);
    if (method === "pay_later" || method === "credit") out.credit += value;
    else if (method === "cash") out.cash += value;
    else if (method === "card") out.card += value;
    else out.other += value;
  }
  return out;
}

async function agingBuckets(sql, params = []) {
  const row = await queryOne(sql, params);
  return {
    d0_15: Number(row?.d0_15 || 0),
    d15_30: Number(row?.d15_30 || 0),
    d30_60: Number(row?.d30_60 || 0),
    d60_90: Number(row?.d60_90 || 0),
    over90: Number(row?.over90 || 0),
  };
}

class DashboardService {
  async getDailyBoard(date) {
    const saleWhere = `AND status IN ('completed', 'partial_return', 'returned')`;
    const [sales, purchases, returnsByMethod, expenses, inventory, customerAging, customerSummary, vendorSummary] =
      await Promise.all([
        moneyByMethod("sales", "created_at", "total", date, saleWhere),
        queryOne(
          `SELECT
             COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS cash,
             COALESCE(SUM(CASE WHEN payment_status IN ('pending', 'partial') THEN total ELSE 0 END), 0) AS credit
           FROM purchases WHERE date(created_at) = date($1)`,
          [date]
        ),
        query(
          `SELECT lower(coalesce(s.payment_method, 'cash')) AS method,
                  COALESCE(SUM(sr.total_refund), 0) AS total
           FROM sale_returns sr
           JOIN sales s ON s.id = sr.sale_id
           WHERE date(sr.created_at) = date($1)
           GROUP BY lower(coalesce(s.payment_method, 'cash'))`,
          [date]
        ),
        queryOne(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date(expense_date) = date($1)`,
          [date]
        ),
        queryOne(
          `SELECT
             SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
             SUM(CASE WHEN quantity > 0 AND quantity <= min_stock THEN 1 ELSE 0 END) AS low_stock,
             COUNT(*) AS products
           FROM products WHERE COALESCE(published, 1) = 1`
        ),
        agingBuckets(
          `SELECT
             COALESCE(SUM(CASE WHEN days <= 15 THEN due ELSE 0 END), 0) AS d0_15,
             COALESCE(SUM(CASE WHEN days > 15 AND days <= 30 THEN due ELSE 0 END), 0) AS d15_30,
             COALESCE(SUM(CASE WHEN days > 30 AND days <= 60 THEN due ELSE 0 END), 0) AS d30_60,
             COALESCE(SUM(CASE WHEN days > 60 AND days <= 90 THEN due ELSE 0 END), 0) AS d60_90,
             COALESCE(SUM(CASE WHEN days > 90 THEN due ELSE 0 END), 0) AS over90
           FROM (
             SELECT
               CAST(julianday('now', 'localtime') - julianday(date(created_at)) AS INTEGER) AS days,
               (COALESCE(original_total, total) - COALESCE(amount_paid, 0)) AS due
             FROM sales
             WHERE customer_id IS NOT NULL
               AND status IN ('completed', 'partial_return')
               AND payment_status IN ('pending', 'partial')
               AND (COALESCE(original_total, total) - COALESCE(amount_paid, 0)) > 0
           ) AS aged`
        ),
        customerService.getGlobalSummary().catch(() => ({ total_pending: 0, customers_with_balance: 0 })),
        supplierService.getGlobalSummary().catch(() => ({
          total_pending: 0,
          total_advance: 0,
          suppliers_with_balance: 0,
          suppliers_with_advance: 0,
          aging: {},
        })),
      ]);

    const returns = { cash: 0, card: 0, credit: 0, other: 0 };
    for (const row of returnsByMethod) {
      const method = String(row.method || "cash");
      const value = Number(row.total || 0);
      if (method === "pay_later" || method === "credit") returns.credit += value;
      else if (method === "cash") returns.cash += value;
      else if (method === "card") returns.card += value;
      else returns.other += value;
    }

    const cashIn = sales.cash + sales.card;
    const cashOut = Number(purchases?.cash || 0) + Number(expenses?.total || 0);
    const netSales = sales.cash + sales.card + sales.credit + sales.other - (returns.cash + returns.card + returns.credit + returns.other);

    return {
      sales,
      returns,
      netSales: Math.max(0, netSales),
      purchases: {
        cash: Number(purchases?.cash || 0),
        credit: Number(purchases?.credit || 0),
        total: Number(purchases?.cash || 0) + Number(purchases?.credit || 0),
      },
      cash: {
        receiving: cashIn,
        payments: cashOut,
        net: cashIn - cashOut,
        expenses: Number(expenses?.total || 0),
      },
      customers: {
        ...customerAging,
        pending: Number(customerSummary?.total_pending || 0),
        count: Number(customerSummary?.customers_with_balance || 0),
      },
      vendors: {
        ...(vendorSummary.aging || {}),
        pending: Number(vendorSummary.total_pending || 0),
        extraPaid: Number(vendorSummary.total_advance || 0),
        extraCount: Number(vendorSummary.suppliers_with_advance || 0),
        count: Number(vendorSummary.suppliers_with_balance || 0),
      },
      inventory: {
        outOfStock: Number(inventory?.out_of_stock || 0),
        lowStock: Number(inventory?.low_stock || 0),
        products: Number(inventory?.products || 0),
      },
    };
  }

  async fetchStats() {
    const settings = useSettingsStore.getState().settings;
    const today = getBusinessDateISO(settings);
    const month = getBusinessPeriodDateRange("monthly", settings);
    const monthTo = month.to || today;
    const [
      todayGrossSales,
      todayReturns,
      todayNetSales,
      todayPurchases,
      totalProducts,
      totalCustomers,
      lowStockSummary,
      stockValue,
      monthProfit,
      monthlyPurchases,
      recentSales,
      recentReturns,
      heldSales,
      smartInsights,
      employeeSummary,
      weeklyTrend,
      customerReceivables,
      dailyBoard,
    ] = await Promise.all([
      getGrossSalesInRange(today, today),
      getReturnsTotalInRange(today, today),
      getNetRevenueInRange(today, today),
      purchaseService.getTodayTotal(),
      productService.count(),
      customerService.count(),
      productService.getLowStockSummary(8),
      productService.getValueSummary(),
      getProfitInRange(month.from, monthTo),
      purchaseService.getMonthlyTotal(),
      saleService.getRecent(8),
      saleService.getRecentReturns(8),
      saleService.getHeldSales(),
      dashboardInsightsService.getInsights(),
      employeeService.getSummary().catch(() => ({
        total: 0,
        current: 0,
        finished: 0,
        monthlySalary: 0,
        monthlyAdvance: 0,
        monthlyPayments: 0,
        totalSalaryPaid: 0,
        totalAdvancePaid: 0,
        totalPayments: 0,
      })),
      getWeeklySalesTrend(settings),
      customerService.getGlobalSummary().catch(() => ({
        total_pending: 0,
        customers_with_balance: 0,
      })),
      this.getDailyBoard(today).catch(() => null),
    ]);

    const monthlyProfit = monthProfit.netProfit;
    const todayTrendPct = computeTodayTrend(todayNetSales, weeklyTrend);

    return {
      todaySales: todayNetSales,
      todayGrossSales,
      todayReturns,
      todayPurchases,
      totalProducts,
      totalCustomers,
      lowStockCount: lowStockSummary.count,
      lowStock: lowStockSummary.items,
      stockValue,
      monthlyRevenue: monthProfit.netRevenue,
      monthlyReturns: monthProfit.salesReturns,
      monthlyProfit,
      recentSales,
      recentReturns,
      heldCount: heldSales?.length ?? 0,
      smartInsights: smartInsights.insights,
      topProducts: smartInsights.topProducts,
      employees: employeeSummary,
      weeklyTrend,
      todayTrendPct,
      customerReceivables,
      dailyBoard,
    };
  }

  refreshStatsCache() {
    const refresh = this.fetchStats()
      .then((stats) => {
        setDashboardCache(stats);
        return stats;
      })
      .catch(() => getDashboardCacheEntry());

    trackDashboardRefresh(refresh);
    return refresh;
  }

  async getStats({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
      const cached = getDashboardCacheEntry();
      if (cached) return cached;
    }

    const stats = await this.fetchStats();
    setDashboardCache(stats);
    return stats;
  }
}

export const dashboardService = new DashboardService();
