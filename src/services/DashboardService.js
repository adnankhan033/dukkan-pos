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

class DashboardService {
  async getStats() {
    const [
      todayGrossSales,
      todayReturns,
      todayNetSales,
      todayPurchases,
      totalProducts,
      totalCustomers,
      lowStock,
      monthlyRevenue,
      monthlyReturns,
      monthlyPurchases,
      monthlyExpenses,
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
      productService.getLowStock(),
      getMonthlyNetRevenue(),
      getMonthlyReturnsTotal(),
      purchaseService.getMonthlyTotal(),
      expenseService.getMonthlyTotal(),
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

    const monthlyCost = await getMonthlyNetCogs();
    const monthlyProfit = monthlyRevenue - monthlyCost - monthlyExpenses;

    return {
      todaySales: todayNetSales,
      todayGrossSales,
      todayReturns,
      todayPurchases,
      totalProducts,
      totalCustomers,
      lowStockCount: lowStock.length,
      lowStock,
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
}

export const dashboardService = new DashboardService();
