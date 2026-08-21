import { query, queryOne } from "../database/connection";
import { productService } from "./ProductService";
import {
  getReturnsInRange,
  getSalesCountInRange,
  getReturnsCountInRange,
  getProfitInRange,
} from "./FinanceService";

class ReportService {
  async getSalesInRange(from, to) {
    return query(
      `SELECT s.*, c.name AS customer_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status IN ('completed', 'partial_return', 'returned')
       AND date(s.created_at) >= date($1) AND date(s.created_at) <= date($2)
       ORDER BY s.created_at DESC`,
      [from, to]
    );
  }

  async getPurchasesInRange(from, to) {
    return query(
      `SELECT p.*, s.company AS supplier_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE date(p.created_at) >= date($1) AND date(p.created_at) <= date($2)
       ORDER BY p.created_at DESC`,
      [from, to]
    );
  }

  async getExpensesInRange(from, to) {
    return query(
      `SELECT * FROM expenses
       WHERE date(expense_date) >= date($1) AND date(expense_date) <= date($2)
       ORDER BY expense_date DESC`,
      [from, to]
    );
  }

  async getPurchasesTotalInRange(from, to) {
    const row = await queryOne(
      `SELECT COALESCE(SUM(total), 0) AS total FROM purchases
       WHERE date(created_at) >= date($1) AND date(created_at) <= date($2)`,
      [from, to]
    );
    return Number(row?.total ?? 0);
  }

  async getExpensesTotalInRange(from, to) {
    const row = await queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE date(expense_date) >= date($1) AND date(expense_date) <= date($2)`,
      [from, to]
    );
    return Number(row?.total ?? 0);
  }

  async getProfitSummaryInRange(from, to) {
    const [profit, purchasesTotal, salesCount, returnsCount] = await Promise.all([
      getProfitInRange(from, to),
      this.getPurchasesTotalInRange(from, to),
      getSalesCountInRange(from, to),
      getReturnsCountInRange(from, to),
    ]);

    const avgSale = salesCount > 0 ? profit.sales / salesCount : 0;
    const profitMargin = profit.netRevenue > 0 ? (profit.netProfit / profit.netRevenue) * 100 : 0;

    return {
      grossSales: profit.sales,
      returnsTotal: profit.salesReturns,
      monthlyRevenue: profit.netRevenue,
      netRevenue: profit.netRevenue,
      purchasesTotal,
      monthlyPurchases: purchasesTotal,
      expensesTotal: profit.expenses,
      monthlyExpenses: profit.expenses,
      cogs: profit.cogs,
      grossProfit: profit.grossProfit,
      netProfit: profit.netProfit,
      salesCount,
      returnsCount,
      avgSale,
      profitMargin,
    };
  }

  async getReportData(from, to) {
    const [summary, sales, returns, purchases, expenses, inventory] = await Promise.all([
      this.getProfitSummaryInRange(from, to),
      this.getSalesInRange(from, to),
      getReturnsInRange(from, to),
      this.getPurchasesInRange(from, to),
      this.getExpensesInRange(from, to),
      this.getInventoryReport(),
    ]);

    return { summary, sales, returns, purchases, expenses, inventory: inventory.items };
  }

  async getDailySales(date) {
    return this.getSalesInRange(date, date);
  }

  async getMonthlySales() {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return this.getSalesInRange(from, to);
  }

  async getMonthlyPurchases() {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return this.getPurchasesInRange(from, to);
  }

  async getMonthlyExpenses() {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return this.getExpensesInRange(from, to);
  }

  async getProfitSummary() {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return this.getProfitSummaryInRange(from, to);
  }

  async getInventoryReport() {
    return productService.getAll({ limit: 1000, page: 1 });
  }

  async getMonthlyReturnsList() {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return getReturnsInRange(from, to);
  }
}

export const reportService = new ReportService();
