import { saleService } from "./SaleService";
import { purchaseService } from "./PurchaseService";
import { productService } from "./ProductService";
import { customerService } from "./CustomerService";
import { expenseService } from "./ExpenseService";
import { query } from "../database/connection";

class DashboardService {
  async getStats() {
    const [
      todaySales,
      todayPurchases,
      totalProducts,
      totalCustomers,
      lowStock,
      monthlyRevenue,
      monthlyPurchases,
      monthlyExpenses,
      recentSales,
      heldSales,
    ] = await Promise.all([
      saleService.getTodayTotal(),
      purchaseService.getTodayTotal(),
      productService.count(),
      customerService.count(),
      productService.getLowStock(),
      saleService.getMonthlyRevenue(),
      purchaseService.getMonthlyTotal(),
      expenseService.getMonthlyTotal(),
      saleService.getRecent(8),
      saleService.getHeldSales(),
    ]);

    const monthlyCost = await this.getMonthlyCostOfGoodsSold();
    const monthlyProfit = monthlyRevenue - monthlyCost - monthlyExpenses;

    return {
      todaySales,
      todayPurchases,
      totalProducts,
      totalCustomers,
      lowStockCount: lowStock.length,
      lowStock,
      monthlyRevenue,
      monthlyProfit,
      recentSales,
      heldCount: heldSales?.length ?? 0,
    };
  }

  async getMonthlyCostOfGoodsSold() {
    const row = await query(
      `SELECT COALESCE(SUM(si.quantity * p.cost_price), 0) as total
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       WHERE s.status = 'completed'
       AND strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')`
    );
    return row[0]?.total ?? 0;
  }
}

export const dashboardService = new DashboardService();
