import { query } from "../database/connection";
import { saleService } from "./SaleService";
import { purchaseService } from "./PurchaseService";
import { expenseService } from "./ExpenseService";
import { productService } from "./ProductService";

class ReportService {
  async getDailySales(date) {
    return query(
      `SELECT s.*, c.name as customer_name
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status = 'completed' AND date(s.created_at) = date($1)
       ORDER BY s.created_at DESC`,
      [date]
    );
  }

  async getDailySalesTotal(date) {
    const rows = await this.getDailySales(date);
    return rows.reduce((sum, s) => sum + s.total, 0);
  }

  async getMonthlySales() {
    return query(
      `SELECT s.*, c.name as customer_name
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status = 'completed'
       AND strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')
       ORDER BY s.created_at DESC`
    );
  }

  async getMonthlyPurchases() {
    return query(
      `SELECT p.*, s.company as supplier_name
       FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id
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
    const monthlyRevenue = await saleService.getMonthlyRevenue();
    const monthlyPurchases = await purchaseService.getMonthlyTotal();
    const monthlyExpenses = await expenseService.getMonthlyTotal();

    const cogsRow = await query(
      `SELECT COALESCE(SUM(si.quantity * p.cost_price), 0) as total
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       WHERE s.status = 'completed'
       AND strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')`
    );
    const cogs = cogsRow[0]?.total ?? 0;
    const grossProfit = monthlyRevenue - cogs;
    const netProfit = grossProfit - monthlyExpenses;

    return {
      monthlyRevenue,
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
}

export const reportService = new ReportService();
