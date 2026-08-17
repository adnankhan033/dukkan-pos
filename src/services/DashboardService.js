import { saleService } from "./SaleService";
import { purchaseService } from "./PurchaseService";
import { productService } from "./ProductService";
import { customerService } from "./CustomerService";
import { expenseService } from "./ExpenseService";
import { employeeService } from "./EmployeeService";
import {
  getMonthlyNetRevenue,
  getMonthlyNetCogs,
  getMonthlyReturnsTotal,
  getTodayGrossSales,
  getTodayReturnsTotal,
  getTodayNetSales,
  getNetRevenueInRange,
} from "./FinanceService";
import { dashboardInsightsService } from "./DashboardInsightsService";
import {
  getDashboardCacheEntry,
  setDashboardCache,
  trackDashboardRefresh,
} from "./DashboardCache";
import { useSettingsStore } from "../contexts/store";
import { getBusinessDateISO } from "../utils/businessDate";

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

class DashboardService {
  async fetchStats() {
    const settings = useSettingsStore.getState().settings;
    const [
      todayGrossSales,
      todayReturns,
      todayNetSales,
      todayPurchases,
      totalProducts,
      totalCustomers,
      lowStockSummary,
      monthlyRevenue,
      monthlyReturns,
      monthlyPurchases,
      monthlyExpenses,
      monthlyCost,
      recentSales,
      recentReturns,
      heldSales,
      smartInsights,
      employeeSummary,
      weeklyTrend,
      customerReceivables,
    ] = await Promise.all([
      getTodayGrossSales(),
      getTodayReturnsTotal(),
      getTodayNetSales(),
      purchaseService.getTodayTotal(),
      productService.count(),
      customerService.count(),
      productService.getLowStockSummary(8),
      getMonthlyNetRevenue(),
      getMonthlyReturnsTotal(),
      purchaseService.getMonthlyTotal(),
      expenseService.getMonthlyTotal(),
      getMonthlyNetCogs(),
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
    ]);

    const monthlyProfit = monthlyRevenue - monthlyCost - monthlyExpenses;
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
      monthlyRevenue,
      monthlyReturns,
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
