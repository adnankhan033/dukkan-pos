import { query, queryOne, execute, insert, runInTransaction, resolveInsertId, ensureEmployeeTables } from "../database/connection";
import { accountingService, safeAccountingPost } from "./AccountingService";

const PAYMENT_TYPES = {
  SALARY: "salary",
  ADVANCE: "advance",
};

function mapEmployee(row) {
  if (!row) return null;
  return {
    ...row,
    is_current: Boolean(row.is_current),
  };
}

function buildEmployeeFilters({ search = "", status = "all" } = {}) {
  const conditions = [];
  const params = [];

  if (status === "current") {
    conditions.push("is_current = 1");
  } else if (status === "finished") {
    conditions.push("is_current = 0");
  }

  if (search.trim()) {
    conditions.push(
      `(full_name LIKE $${params.length + 1} OR designation LIKE $${params.length + 1} OR phone LIKE $${params.length + 1} OR iqama_number LIKE $${params.length + 1} OR address LIKE $${params.length + 1})`
    );
    params.push(`%${search.trim()}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

function normalizeEmployeeInput(data) {
  return {
    full_name: String(data.full_name || "").trim(),
    designation: data.designation?.trim() || null,
    phone: data.phone?.trim() || null,
    address: data.address?.trim() || null,
    iqama_number: data.iqama_number?.trim() || null,
    photo: data.photo || null,
    start_date: data.start_date || null,
    end_date: data.is_current ? null : data.end_date || null,
    is_current: data.is_current ? 1 : 0,
    user_id: data.user_id ? Number(data.user_id) : null,
    notes: data.notes?.trim() || null,
  };
}

class EmployeeService {
  async ready() {
    await ensureEmployeeTables();
  }

  async getAll({ search = "", status = "all" } = {}) {
    await this.ready();
    const { where, params } = buildEmployeeFilters({ search, status });
    const rows = await query(
      `SELECT * FROM employees ${where} ORDER BY is_current DESC, full_name ASC`,
      params
    );
    return rows.map(mapEmployee);
  }

  async getById(id) {
    await this.ready();
    const row = await queryOne("SELECT * FROM employees WHERE id = $1", [Number(id)]);
    return mapEmployee(row);
  }

  async getSummary() {
    await this.ready();
    const [totals, payments, allTime] = await Promise.all([
      queryOne(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN is_current = 1 THEN 1 ELSE 0 END) AS current_count,
           SUM(CASE WHEN is_current = 0 THEN 1 ELSE 0 END) AS finished_count
         FROM employees`
      ),
      queryOne(
        `SELECT
           COALESCE(SUM(CASE WHEN payment_type = 'salary' THEN amount ELSE 0 END), 0) AS salary_total,
           COALESCE(SUM(CASE WHEN payment_type = 'advance' THEN amount ELSE 0 END), 0) AS advance_total,
           COUNT(*) AS payment_count
         FROM employee_salaries
         WHERE strftime('%Y-%m', salary_date) = strftime('%Y-%m', 'now')`
      ),
      queryOne(
        `SELECT
           COALESCE(SUM(CASE WHEN payment_type = 'salary' THEN amount ELSE 0 END), 0) AS salary_total,
           COALESCE(SUM(CASE WHEN payment_type = 'advance' THEN amount ELSE 0 END), 0) AS advance_total,
           COUNT(*) AS payment_count
         FROM employee_salaries`
      ),
    ]);

    return {
      total: Number(totals?.total ?? 0),
      current: Number(totals?.current_count ?? 0),
      finished: Number(totals?.finished_count ?? 0),
      monthlySalary: Number(payments?.salary_total ?? 0),
      monthlyAdvance: Number(payments?.advance_total ?? 0),
      monthlyPayments: Number(payments?.payment_count ?? 0),
      totalSalaryPaid: Number(allTime?.salary_total ?? 0),
      totalAdvancePaid: Number(allTime?.advance_total ?? 0),
      totalPayments: Number(allTime?.payment_count ?? 0),
    };
  }

  async getPayrollSummary(employeeId) {
    const row = await queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_type = 'salary' THEN amount ELSE 0 END), 0) AS salary_total,
         COALESCE(SUM(CASE WHEN payment_type = 'advance' THEN amount ELSE 0 END), 0) AS advance_total,
         COUNT(*) AS payment_count
       FROM employee_salaries
       WHERE employee_id = $1`,
      [Number(employeeId)]
    );

    const salaryTotal = Number(row?.salary_total ?? 0);
    const advanceTotal = Number(row?.advance_total ?? 0);

    return {
      salaryTotal,
      advanceTotal,
      paymentCount: Number(row?.payment_count ?? 0),
      netPaid: salaryTotal - advanceTotal,
    };
  }

  async getPayments(employeeId, { paymentType = "all" } = {}) {
    const params = [Number(employeeId)];
    let typeFilter = "";
    if (paymentType !== "all") {
      typeFilter = "AND payment_type = $2";
      params.push(paymentType);
    }

    return query(
      `SELECT * FROM employee_salaries
       WHERE employee_id = $1 ${typeFilter}
       ORDER BY salary_date DESC, id DESC`,
      params
    );
  }

  async create(data) {
    await this.ready();
    const payload = normalizeEmployeeInput(data);
    if (!payload.full_name) throw new Error("Full name is required");

    const id = await insert(
      `INSERT INTO employees
       (full_name, designation, phone, address, iqama_number, photo, start_date, end_date, is_current, user_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        payload.full_name,
        payload.designation,
        payload.phone,
        payload.address,
        payload.iqama_number,
        payload.photo,
        payload.start_date,
        payload.end_date,
        payload.is_current,
        payload.user_id,
        payload.notes,
      ]
    );
    return this.getById(id);
  }

  async update(id, data) {
    const payload = normalizeEmployeeInput(data);
    if (!payload.full_name) throw new Error("Full name is required");

    await execute(
      `UPDATE employees
       SET full_name = $1, designation = $2, phone = $3, address = $4, iqama_number = $5, photo = $6,
           start_date = $7, end_date = $8, is_current = $9, user_id = $10, notes = $11,
           updated_at = datetime('now')
       WHERE id = $12`,
      [
        payload.full_name,
        payload.designation,
        payload.phone,
        payload.address,
        payload.iqama_number,
        payload.photo,
        payload.start_date,
        payload.end_date,
        payload.is_current,
        payload.user_id,
        payload.notes,
        Number(id),
      ]
    );
    return this.getById(id);
  }

  async delete(id) {
    await execute("DELETE FROM employees WHERE id = $1", [Number(id)]);
    return true;
  }

  async addPayment({ employeeId, amount, salaryDate, paymentType, periodLabel, notes }) {
    const employee = await this.getById(employeeId);
    if (!employee) throw new Error("Employee not found");

    const type = paymentType === PAYMENT_TYPES.ADVANCE ? PAYMENT_TYPES.ADVANCE : PAYMENT_TYPES.SALARY;
    const value = Number(amount);
    if (!value || value <= 0) throw new Error("Amount must be greater than zero");

    const result = await runInTransaction(async ({ execute: txExecute, query: txQuery }) => {
      const expenseName =
        type === PAYMENT_TYPES.ADVANCE
          ? `Salary advance — ${employee.full_name}`
          : `Salary — ${employee.full_name}${periodLabel ? ` (${periodLabel})` : ""}`;

      const expenseResult = await txExecute(
        "INSERT INTO expenses (name, category, amount, expense_date, notes) VALUES ($1, $2, $3, $4, $5)",
        [expenseName, "salary", value, salaryDate, notes || null]
      );
      const expenseRows = await txQuery("SELECT last_insert_rowid() AS id");
      const expenseId = resolveInsertId(expenseResult, expenseRows);
      if (!expenseId) throw new Error("Failed to create expense record");

      const paymentResult = await txExecute(
        `INSERT INTO employee_salaries
         (employee_id, amount, salary_date, payment_type, period_label, notes, expense_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          Number(employeeId),
          value,
          salaryDate,
          type,
          periodLabel || null,
          notes || null,
          expenseId,
        ]
      );
      const paymentRows = await txQuery("SELECT last_insert_rowid() AS id");
      const paymentId = resolveInsertId(paymentResult, paymentRows);
      if (!paymentId) throw new Error("Failed to create salary record");

      const rows = await txQuery("SELECT * FROM employee_salaries WHERE id = $1", [paymentId]);
      return rows[0] ?? null;
    });
    const payment = await queryOne("SELECT * FROM employee_salaries WHERE id = $1", [result?.id]);
    if (payment?.expense_id) {
      const expense = await queryOne("SELECT * FROM expenses WHERE id = $1", [payment.expense_id]);
      await safeAccountingPost(() => accountingService.postExpense(expense));
    }
    return result;
  }

  async deletePayment(id) {
    const payment = await queryOne("SELECT * FROM employee_salaries WHERE id = $1", [Number(id)]);
    if (!payment) throw new Error("Payment record not found");

    if (payment.expense_id) {
      const expense = await queryOne("SELECT * FROM expenses WHERE id = $1", [payment.expense_id]);
      if (expense?.journal_entry_id) {
        await safeAccountingPost(() =>
          accountingService.reverseJournal(expense.journal_entry_id, "Salary cancelled")
        );
      }
    }

    return runInTransaction(async ({ execute: txExecute }) => {
      if (payment.expense_id) {
        await txExecute("DELETE FROM expenses WHERE id = $1", [payment.expense_id]);
      }
      await txExecute("DELETE FROM employee_salaries WHERE id = $1", [Number(id)]);
      return true;
    });
  }

  async updatePayment(id, { amount, salaryDate, periodLabel, notes }) {
    await this.ready();
    const payment = await queryOne("SELECT * FROM employee_salaries WHERE id = $1", [Number(id)]);
    if (!payment) throw new Error("Payment record not found");

    const employee = await this.getById(payment.employee_id);
    if (!employee) throw new Error("Employee not found");

    const value = Number(amount);
    if (!value || value <= 0) throw new Error("Amount must be greater than zero");

    const type = payment.payment_type === PAYMENT_TYPES.ADVANCE ? PAYMENT_TYPES.ADVANCE : PAYMENT_TYPES.SALARY;
    const expenseName =
      type === PAYMENT_TYPES.ADVANCE
        ? `Salary advance — ${employee.full_name}`
        : `Salary — ${employee.full_name}${periodLabel ? ` (${periodLabel})` : ""}`;

    return runInTransaction(async ({ execute: txExecute, query: txQuery }) => {
      await txExecute(
        `UPDATE employee_salaries
         SET amount = $1, salary_date = $2, period_label = $3, notes = $4, updated_at = datetime('now')
         WHERE id = $5`,
        [value, salaryDate, periodLabel || null, notes || null, Number(id)]
      );

      if (payment.expense_id) {
        await txExecute(
          `UPDATE expenses
           SET name = $1, amount = $2, expense_date = $3, notes = $4, updated_at = datetime('now')
           WHERE id = $5`,
          [expenseName, value, salaryDate, notes || null, payment.expense_id]
        );
      }

      const rows = await txQuery("SELECT * FROM employee_salaries WHERE id = $1", [Number(id)]);
      return rows[0] ?? null;
    });
  }
}

export const employeeService = new EmployeeService();
export { PAYMENT_TYPES };
