import { queryOne } from "../database/connection";
import { saleService } from "./SaleService";
import { purchaseService } from "./PurchaseService";
import { productService } from "./ProductService";
import { customerService } from "./CustomerService";
import { supplierService } from "./SupplierService";
import { employeeService } from "./EmployeeService";
import {
  getGrossSalesInRange,
  getNetRevenueInRange,
  getPaymentBreakdownInRange,
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
    const [paymentBreakdown, purchases, expenses, inventory, customerAging, customerSummary, vendorSummary] =
      await Promise.all([
        getPaymentBreakdownInRange(date, date),
        queryOne(
          `SELECT
             COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS cash,
             COALESCE(SUM(CASE WHEN payment_status IN ('pending', 'partial') THEN total ELSE 0 END), 0) AS credit
           FROM purchases WHERE date(created_at) = date($1)`,
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

    const sales = {
      cash: Number(paymentBreakdown.cash?.gross || 0),
      card: Number(paymentBreakdown.card?.gross || 0),
      credit: Number(paymentBreakdown.credit?.gross || 0),
      other: Number(paymentBreakdown.other?.gross || 0),
    };
    const returns = {
      cash: Number(paymentBreakdown.cash?.returns || 0),
      card: Number(paymentBreakdown.card?.returns || 0),
      credit: Number(paymentBreakdown.credit?.returns || 0),
      other: Number(paymentBreakdown.other?.returns || 0),
    };

    const cashIn = Number(paymentBreakdown.cash?.net || 0);
    const cashOut = Number(purchases?.cash || 0) + Number(expenses?.total || 0);
    const netSales =
      sales.cash +
      sales.card +
      sales.credit +
      sales.other -
      (returns.cash + returns.card + returns.credit + returns.other);

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
      purchaseService.getTodayTotal(today),
      productService.count(),
      customerService.count(),
      productService.getLowStockSummary(8),
      productService.getValueSummary(),
      getProfitInRange(month.from, monthTo),
      purchaseService.getMonthlyTotal(month.from, monthTo),
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
      monthlyRevenue: monthProfit.netRevenueInclusive,
      monthlyReturns: monthProfit.salesReturnsInclusive,
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
