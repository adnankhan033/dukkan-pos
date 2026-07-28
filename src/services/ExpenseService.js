import { query, queryOne, execute, insert } from "../database/connection";

class ExpenseService {
  async getAll({ page = 1, limit = 10 } = {}) {
    const countRow = await queryOne("SELECT COUNT(*) as total FROM expenses");
    const total = countRow?.total ?? 0;

    const items = await query(
      "SELECT * FROM expenses ORDER BY expense_date DESC LIMIT $1 OFFSET $2",
      [limit, (page - 1) * limit]
    );
    return { items, total, page, limit };
  }

  async getById(id) {
    return queryOne("SELECT * FROM expenses WHERE id = $1", [id]);
  }

  async create(data) {
    const id = await insert(
      "INSERT INTO expenses (name, amount, expense_date, notes) VALUES ($1, $2, $3, $4)",
      [data.name, Number(data.amount), data.expense_date, data.notes || null]
    );
    return this.getById(id);
  }

  async update(id, data) {
    await execute(
      `UPDATE expenses SET name = $1, amount = $2, expense_date = $3, notes = $4,
       updated_at = datetime('now') WHERE id = $5`,
      [data.name, Number(data.amount), data.expense_date, data.notes || null, id]
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
