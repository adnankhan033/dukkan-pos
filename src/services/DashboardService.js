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
} from "./FinanceService";
import { dashboardInsightsService } from "./DashboardInsightsService";
import {
  getDashboardCacheEntry,
  setDashboardCache,
  trackDashboardRefresh,
} from "./DashboardCache";

class DashboardService {
  async fetchStats() {
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
    ]);

    const monthlyProfit = monthlyRevenue - monthlyCost - monthlyExpenses;

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
