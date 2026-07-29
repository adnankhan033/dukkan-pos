import { query } from "../database/connection";
import { purchaseService } from "./PurchaseService";
import { expenseService } from "./ExpenseService";
import { productService } from "./ProductService";
import {
  getMonthlyGrossSales,
  getMonthlyReturnsTotal,
  getMonthlyNetRevenue,
  getMonthlyNetCogs,
  getMonthlyReturns,
} from "./FinanceService";

class ReportService {
  async getDailySales(date) {
    return query(
      `SELECT s.*, c.name AS customer_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status IN ('completed', 'partial_return', 'returned')
       AND date(s.created_at) = date($1)
       ORDER BY s.created_at DESC`,
      [date]
    );
  }

  async getMonthlySales() {
    return query(
      `SELECT s.*, c.name AS customer_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status IN ('completed', 'partial_return', 'returned')
       AND strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')
       ORDER BY s.created_at DESC`
    );
  }

  async getMonthlyPurchases() {
    return query(
      `SELECT p.*, s.company AS supplier_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now')
       ORDER BY p.created_at DESC`
    );
  }

  async getMonthlyExpenses() {
    return query(
      `SELECT * FROM expenses
       WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')
       ORDER BY expense_date DESC`
    );
  }

  async getProfitSummary() {
    const [
      grossSales,
      returnsTotal,
      netRevenue,
      cogs,
      monthlyPurchases,
      monthlyExpenses,
    ] = await Promise.all([
      getMonthlyGrossSales(),
      getMonthlyReturnsTotal(),
      getMonthlyNetRevenue(),
      getMonthlyNetCogs(),
      purchaseService.getMonthlyTotal(),
      expenseService.getMonthlyTotal(),
    ]);

    const grossProfit = netRevenue - cogs;
    const netProfit = grossProfit - monthlyExpenses;

    return {
      grossSales,
      returnsTotal,
      monthlyRevenue: netRevenue,
      monthlyPurchases,
      monthlyExpenses,
      cogs,
      grossProfit,
      netProfit,
    };
  }

  async getInventoryReport() {
    return productService.getAll({ limit: 1000, page: 1 });
  }

  async getMonthlyReturnsList() {
    return getMonthlyReturns();
  }
}

export const reportService = new ReportService();
