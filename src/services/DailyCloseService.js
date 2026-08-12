import { query, queryOne, execute, ensureDailyCloseSchema } from "../database/connection";
import { reportService } from "./ReportService";
import {
  getGrossSalesInRange,
  getReturnsTotalInRange,
  getNetRevenueInRange,
  getSalesCountInRange,
  getReturnsCountInRange,
  getReturnsInRange,
  getPaymentBreakdownInRange,
  getHeldOrdersCountInRange,
} from "./FinanceService";

class DailyCloseService {
  async ensureReady() {
    await ensureDailyCloseSchema();
  }

  async getDailyCloseData(date, { paymentMethod = "all" } = {}) {
    if (!date) {
      throw new Error("Business date is required.");
    }

    await this.ensureReady();

    const from = date;
    const to = date;

    const [
      grossSales,
      returnsTotal,
      netSales,
      salesCount,
      returnsCount,
      heldCount,
      paymentBreakdown,
      expensesTotal,
      sales,
      returns,
      existingClose,
    ] = await Promise.all([
      getGrossSalesInRange(from, to),
      getReturnsTotalInRange(from, to),
      getNetRevenueInRange(from, to),
      getSalesCountInRange(from, to),
      getReturnsCountInRange(from, to),
      getHeldOrdersCountInRange(from, to),
      getPaymentBreakdownInRange(from, to),
      reportService.getExpensesTotalInRange(from, to),
      this.getSalesForDate(date, paymentMethod),
      getReturnsInRange(from, to),
      this.getCloseByDate(date),
    ]);

    return {
      date,
      paymentMethod,
      summary: {
        grossSales,
        returnsTotal,
        netSales,
        salesCount,
        returnsCount,
        heldCount,
        expensesTotal,
        cashTotal: paymentBreakdown.cash.net,
        cardTotal: paymentBreakdown.card.net,
        cashGross: paymentBreakdown.cash.gross,
        cardGross: paymentBreakdown.card.gross,
        cashReturns: paymentBreakdown.cash.returns,
        cardReturns: paymentBreakdown.card.returns,
        cashCount: paymentBreakdown.cash.count,
        cardCount: paymentBreakdown.card.count,
      },
      paymentBreakdown,
      sales,
      returns,
      existingClose,
      isClosed: Boolean(existingClose),
    };
  }

  async getSalesForDate(date, paymentMethod = "all") {
    const params = [date, date];
    let methodFilter = "";
    if (paymentMethod && paymentMethod !== "all") {
      methodFilter = ` AND s.payment_method = $${params.length + 1}`;
      params.push(paymentMethod);
    }

    return query(
      `SELECT s.*, c.name AS customer_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status IN ('completed', 'partial_return', 'returned')
       AND date(s.created_at) >= date($1) AND date(s.created_at) <= date($2)
       ${methodFilter}
       ORDER BY s.created_at DESC`,
      params
    );
  }

  async getCloseByDate(date) {
    await this.ensureReady();
    return queryOne("SELECT * FROM daily_closes WHERE business_date = $1", [date]);
  }

  async getCloseHistory({ page = 1, limit = 10 } = {}) {
    await this.ensureReady();
    const offset = (page - 1) * limit;
    const [items, countRow] = await Promise.all([
      query(
        `SELECT * FROM daily_closes ORDER BY business_date DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      queryOne("SELECT COUNT(*) AS count FROM daily_closes"),
    ]);
    return {
      items,
      total: Number(countRow?.count ?? 0),
      page,
      limit,
    };
  }

  async closeDay({ date, user, notes = "", cashCounted = null, paymentMethod = "all" }) {
    const data = await this.getDailyCloseData(date, { paymentMethod: "all" });
    const { summary } = data;

    if (summary.heldCount > 0) {
      throw new Error(
        `${summary.heldCount} held order(s) remain for this date. Complete or cancel them before closing.`
      );
    }

    const cashCountedNum = cashCounted != null && cashCounted !== "" ? Number(cashCounted) : null;
    const cashVariance =
      cashCountedNum != null && Number.isFinite(cashCountedNum)
        ? cashCountedNum - summary.cashTotal
        : null;

    const snapshot = {
      date,
      paymentMethod,
      summary,
      sales: data.sales,
      returns: data.returns,
      closedAt: new Date().toISOString(),
    };

    const existing = await this.getCloseByDate(date);
    const params = [
      date,
      new Date().toISOString(),
      user?.id ?? null,
      user?.username ?? user?.full_name ?? "Unknown",
      summary.grossSales,
      summary.returnsTotal,
      summary.netSales,
      summary.cashTotal,
      summary.cardTotal,
      summary.salesCount,
      summary.returnsCount,
      summary.heldCount,
      summary.expensesTotal,
      cashCountedNum,
      cashVariance,
      notes?.trim() || null,
      JSON.stringify(snapshot),
    ];

    if (existing) {
      await execute(
        `UPDATE daily_closes SET
          closed_at = $2,
          closed_by_user_id = $3,
          closed_by_username = $4,
          gross_sales = $5,
          returns_total = $6,
          net_sales = $7,
          cash_total = $8,
          card_total = $9,
          sales_count = $10,
          returns_count = $11,
          held_count = $12,
          expenses_total = $13,
          cash_counted = $14,
          cash_variance = $15,
          notes = $16,
          snapshot_json = $17,
          updated_at = datetime('now')
         WHERE business_date = $1`,
        params
      );
      return this.getCloseByDate(date);
    }

    await execute(
      `INSERT INTO daily_closes (
        business_date, closed_at, closed_by_user_id, closed_by_username,
        gross_sales, returns_total, net_sales, cash_total, card_total,
        sales_count, returns_count, held_count, expenses_total,
        cash_counted, cash_variance, notes, snapshot_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      params
    );

    return this.getCloseByDate(date);
  }
}

export const dailyCloseService = new DailyCloseService();
