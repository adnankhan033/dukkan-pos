import { query, queryOne, execute, insert } from "../database/connection";
import { getPeriodDateRange } from "../utils/format";

function buildExpenseFilters({ period, dateFrom, dateTo, category, search, referenceDate }) {
  const conditions = [];
  const params = [];

  if (category && category !== "all") {
    conditions.push(`category = $${params.length + 1}`);
    params.push(category);
  }

  if (search?.trim()) {
    conditions.push(`(name LIKE $${params.length + 1} OR notes LIKE $${params.length + 1})`);
    params.push(`%${search.trim()}%`);
  }

  let from = dateFrom;
  let to = dateTo;

  if (period && period !== "all") {
    const range = getPeriodDateRange(period, referenceDate || new Date());
    from = range.from;
    to = range.to;
  }

  if (from) {
    conditions.push(`date(expense_date) >= date($${params.length + 1})`);
    params.push(from);
  }
  if (to) {
    conditions.push(`date(expense_date) <= date($${params.length + 1})`);
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

class ExpenseService {
  async getAll({
    page = 1,
    limit = 10,
    period = "all",
    dateFrom = null,
    dateTo = null,
    category = "all",
    search = "",
    referenceDate = null,
  } = {}) {
    const { where, params } = buildExpenseFilters({
      period,
      dateFrom,
      dateTo,
      category,
      search,
      referenceDate,
    });

    const countRow = await queryOne(
      `SELECT COUNT(*) as total FROM expenses ${where}`,
      params
    );
    const total = countRow?.total ?? 0;

    const items = await query(
      `SELECT * FROM expenses ${where}
       ORDER BY expense_date DESC, id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    );

    return { items, total, page, limit };
  }

  async getSummary({
    period = "all",
    dateFrom = null,
    dateTo = null,
    category = "all",
    search = "",
    referenceDate = null,
  } = {}) {
    const { where, params } = buildExpenseFilters({
      period,
      dateFrom,
      dateTo,
      category,
      search,
      referenceDate,
    });

    const totalRow = await queryOne(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses ${where}`,
      params
    );

    const byCategory = await query(
      `SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses ${where}
       GROUP BY category
       ORDER BY total DESC`,
      params
    );

    return {
      total: Number(totalRow?.total ?? 0),
      count: Number(totalRow?.count ?? 0),
      byCategory,
    };
  }

  async getById(id) {
    return queryOne("SELECT * FROM expenses WHERE id = $1", [id]);
  }

  async create(data) {
    const id = await insert(
      "INSERT INTO expenses (name, category, amount, expense_date, notes) VALUES ($1, $2, $3, $4, $5)",
      [
        data.name,
        data.category || "other",
        Number(data.amount),
        data.expense_date,
        data.notes || null,
      ]
    );
    return this.getById(id);
  }

  async update(id, data) {
    await execute(
      `UPDATE expenses SET name = $1, category = $2, amount = $3, expense_date = $4, notes = $5,
       updated_at = datetime('now') WHERE id = $6`,
      [
        data.name,
        data.category || "other",
        Number(data.amount),
        data.expense_date,
        data.notes || null,
        id,
      ]
    );
    return this.getById(id);
  }

  async delete(id) {
    await execute("DELETE FROM expenses WHERE id = $1", [id]);
    return true;
  }

  async getMonthlyTotal() {
    const row = await queryOne(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
       WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')`
    );
    return row?.total ?? 0;
  }

  async getDailyTotal(date) {
    const row = await queryOne(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(expense_date) = date($1)`,
      [date]
    );
    return row?.total ?? 0;
  }
}

export const expenseService = new ExpenseService();
