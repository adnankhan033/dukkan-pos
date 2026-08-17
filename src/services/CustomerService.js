import { query, queryOne, execute, insert } from "../database/connection";
import { saleService } from "./SaleService";
import { SALE_PAYMENT_STATUS, PAYMENT_METHODS } from "../utils/constants";
import { appendBusinessDateRangeFilter } from "../utils/businessDateFilter";
import { hasCustomerDateRange } from "../utils/customerFilters";

function normalizeFilters(filters = {}) {
  return {
    customerId: filters.customerId ? String(filters.customerId) : "",
    search: String(filters.search || "").trim(),
    phone: String(filters.phone || "").trim(),
    address: String(filters.address || "").trim(),
    from: String(filters.from || "").trim(),
    to: String(filters.to || "").trim(),
    fromTime: filters.fromTime || "00:00",
    toTime: filters.toTime || "23:59",
  };
}

function col(field, alias) {
  return alias ? `${alias}.${field}` : field;
}

function appendCustomerContactFilters(filters, params, alias = "c") {
  const normalized = normalizeFilters(filters);
  const parts = [];

  if (normalized.customerId) {
    params.push(Number(normalized.customerId));
    parts.push(`${col("id", alias)} = $${params.length}`);
  }
  if (normalized.search) {
    params.push(`%${normalized.search}%`);
    parts.push(
      `(${col("name", alias)} LIKE $${params.length} OR ${col("email", alias)} LIKE $${params.length})`
    );
  }
  if (normalized.phone) {
    params.push(`%${normalized.phone}%`);
    parts.push(`${col("phone", alias)} LIKE $${params.length}`);
  }
  if (normalized.address) {
    params.push(`%${normalized.address}%`);
    parts.push(`${col("address", alias)} LIKE $${params.length}`);
  }

  return parts;
}

function buildCustomerWhereClause(filters, params, alias = "c") {
  const parts = appendCustomerContactFilters(filters, params, alias);
  return parts.length ? `WHERE ${parts.join(" AND ")}` : "WHERE 1=1";
}

function buildSalesDateFilter(filters, params, settings, column = "created_at") {
  const normalized = normalizeFilters(filters);
  if (!hasCustomerDateRange(normalized)) return "";

  const from = normalized.from || "1970-01-01";
  const to = normalized.to || "2099-12-31";
  return appendBusinessDateRangeFilter(
    column,
    {
      from,
      to,
      fromTime: normalized.fromTime,
      toTime: normalized.toTime,
    },
    params,
    settings
  );
}

/** Pay-later and unpaid account orders — excludes walk-in cash/card sales with an optional customer tag. */
function accountOrderSql(alias = "s") {
  const paymentMethod = col("payment_method", alias);
  const paymentStatus = col("payment_status", alias);
  return `(
    ${paymentMethod} = '${PAYMENT_METHODS.PAY_LATER}'
    OR ${paymentStatus} IN ('${SALE_PAYMENT_STATUS.PENDING}', '${SALE_PAYMENT_STATUS.PARTIAL}')
  )`;
}

function appendAccountOrderFilter(alias = "s") {
  return `AND ${accountOrderSql(alias)}`;
}

function summarizeStatementOrders(orders = []) {
  return orders.reduce(
    (acc, order) => {
      if (!["completed", "partial_return"].includes(order.status)) {
        return acc;
      }
      acc.total_invoiced += Number(order.total) || 0;
      acc.total_paid += Number(order.amount_paid) || 0;
      acc.balance_pending += Number(order.balance_due) || 0;
      if (
        order.payment_status === SALE_PAYMENT_STATUS.PENDING ||
        order.payment_status === SALE_PAYMENT_STATUS.PARTIAL
      ) {
        acc.pending_orders += 1;
      }
      return acc;
    },
    { total_invoiced: 0, total_paid: 0, balance_pending: 0, pending_orders: 0 }
  );
}

function buildBalanceJoinSql(filters, params, settings) {
  const dateFilter = buildSalesDateFilter(filters, params, settings, "s.created_at");
  return `LEFT JOIN (
    SELECT s.customer_id,
           SUM(s.total) AS total_invoiced,
           SUM(COALESCE(s.amount_paid, 0)) AS total_paid,
           SUM(s.total - COALESCE(s.amount_paid, 0)) AS balance_pending,
           SUM(CASE WHEN s.payment_status IN ('pending', 'partial') THEN 1 ELSE 0 END) AS pending_count
    FROM sales s
    WHERE s.customer_id IS NOT NULL
      AND s.status IN ('completed', 'partial_return')
      ${appendAccountOrderFilter("s")}
      ${dateFilter}
    GROUP BY s.customer_id
  ) b ON b.customer_id = c.id`;
}

class CustomerService {
  async getAll({ search = "", page = 1, limit = 10 } = {}) {
    let sql = "SELECT * FROM customers WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name LIKE $${params.length} OR phone LIKE $${params.length} OR email LIKE $${params.length})`;
    }

    const countRow = await queryOne(sql.replace("SELECT *", "SELECT COUNT(*) as total"), params);
    const total = countRow?.total ?? 0;

    sql += " ORDER BY name ASC";
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push((page - 1) * limit);
    sql += ` OFFSET $${params.length}`;

    const items = await query(sql, params);
    return { items, total, page, limit };
  }

  async getAllWithBalances({ search = "", filters = {}, page = 1, limit = 10, settings = {} } = {}) {
    const mergedFilters = normalizeFilters({
      ...filters,
      search: filters.search || search,
    });

    const contactParams = [];
    const where = buildCustomerWhereClause(mergedFilters, contactParams, "c");
    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM customers c ${where}`,
      contactParams
    );
    const total = countRow?.total ?? 0;

    const params = [];
    const balanceJoin = buildBalanceJoinSql(mergedFilters, params, settings);
    const whereForList = buildCustomerWhereClause(mergedFilters, params, "c");
    const listParams = [...params, limit, (page - 1) * limit];

    const items = await query(
      `SELECT c.*,
              COALESCE(b.total_invoiced, 0) AS total_invoiced,
              COALESCE(b.total_paid, 0) AS total_paid,
              COALESCE(b.balance_pending, 0) AS balance_pending,
              COALESCE(b.pending_count, 0) AS pending_count
       FROM customers c
       ${balanceJoin}
       ${whereForList}
       ORDER BY balance_pending DESC, c.name ASC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    return { items, total, page, limit };
  }

  async getBalanceSummary(customerId) {
    const row = await queryOne(
      `SELECT
         COALESCE(SUM(s.total), 0) AS total_invoiced,
         COALESCE(SUM(s.amount_paid), 0) AS total_paid,
         COALESCE(SUM(s.total - COALESCE(s.amount_paid, 0)), 0) AS balance_pending,
         SUM(CASE WHEN s.payment_status IN ('pending', 'partial') THEN 1 ELSE 0 END) AS pending_orders
       FROM sales s
       WHERE s.customer_id = $1
         AND s.status IN ('completed', 'partial_return')
         ${appendAccountOrderFilter("s")}`,
      [customerId]
    );
    return {
      total_invoiced: row?.total_invoiced ?? 0,
      total_paid: row?.total_paid ?? 0,
      balance_pending: row?.balance_pending ?? 0,
      pending_orders: row?.pending_orders ?? 0,
    };
  }

  async getLedger(customerId) {
    const [summary, orders, payments] = await Promise.all([
      this.getBalanceSummary(customerId),
      query(
        `SELECT s.id, s.sale_number, s.total, s.amount_paid,
                (s.total - COALESCE(s.amount_paid, 0)) AS balance_due,
                s.payment_status, s.payment_method, s.due_date, s.notes, s.created_at
         FROM sales s
         WHERE s.customer_id = $1
           AND s.status IN ('completed', 'partial_return', 'returned', 'held')
           ${appendAccountOrderFilter("s")}
         ORDER BY s.created_at DESC`,
        [customerId]
      ),
      query(
        `SELECT cp.*, s.sale_number
         FROM customer_payments cp
         LEFT JOIN sales s ON s.id = cp.sale_id AND s.customer_id = cp.customer_id
         WHERE cp.customer_id = $1
         ORDER BY cp.payment_date DESC, cp.created_at DESC`,
        [customerId]
      ),
    ]);

    return { summary, orders, payments };
  }

  async getStatementForExport(customerId, { filters = {}, settings = {} } = {}) {
    const id = Number(customerId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Customer not found");
    }

    const customer = await this.getById(id);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const mergedFilters = normalizeFilters({
      ...filters,
      customerId: String(id),
    });

    const orderParams = [id];
    const orderDateFilter = buildSalesDateFilter(mergedFilters, orderParams, settings, "s.created_at");

    const orders = await query(
      `SELECT s.id, s.sale_number, s.subtotal, s.discount, s.vat, s.total,
              s.amount_paid, s.payment_status, s.payment_method, s.status,
              (s.total - COALESCE(s.amount_paid, 0)) AS balance_due,
              s.notes, s.created_at
       FROM sales s
       WHERE s.customer_id = $1
         AND s.status IN ('completed', 'partial_return', 'returned')
         ${appendAccountOrderFilter("s")}
         ${orderDateFilter}
       ORDER BY s.created_at DESC`,
      orderParams
    );

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await query(
          `SELECT si.quantity, si.unit_price, si.discount, si.total,
                  p.name AS product_name, p.name_ar AS product_name_ar, p.barcode
           FROM sale_items si
           LEFT JOIN products p ON p.id = si.product_id
           WHERE si.sale_id = $1
           ORDER BY si.id ASC`,
          [order.id]
        );
        return { ...order, items };
      })
    );

    const paymentParams = [id];
    const paymentDateFilter = buildSalesDateFilter(
      mergedFilters,
      paymentParams,
      settings,
      "cp.payment_date"
    );

    const payments = await query(
      `SELECT cp.*, s.sale_number
       FROM customer_payments cp
       LEFT JOIN sales s ON s.id = cp.sale_id AND s.customer_id = cp.customer_id
       WHERE cp.customer_id = $1
         ${paymentDateFilter}
       ORDER BY cp.payment_date DESC, cp.created_at DESC`,
      paymentParams
    );

    return {
      customer,
      summary: summarizeStatementOrders(ordersWithItems),
      orders: ordersWithItems,
      payments,
    };
  }

  async recordPayment({
    customerId,
    amount,
    notes,
    saleId = null,
    paymentMethod = PAYMENT_METHODS.CASH,
    paymentDate = null,
  }) {
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      throw new Error("Enter a valid payment amount");
    }

    const summary = await this.getBalanceSummary(customerId);
    if (payAmount > summary.balance_pending + 0.01) {
      throw new Error(`Payment exceeds pending balance (${summary.balance_pending.toFixed(2)})`);
    }

    if (saleId) {
      await saleService.applyPaymentToSale(saleId, payAmount, paymentMethod, notes);
    } else {
      const pending = await saleService.getPendingByCustomer(customerId);
      let remaining = payAmount;
      let totalRecorded = 0;

      for (const order of pending) {
        if (remaining <= 0) break;
        const applied = await saleService.applyPaymentToSale(
          order.id,
          remaining,
          paymentMethod,
          totalRecorded === 0 ? notes : null
        );
        if (applied <= 0) continue;
        remaining -= applied;
        totalRecorded += applied;
      }

      if (totalRecorded <= 0) {
        throw new Error("No pending balance to pay");
      }
    }

    return this.getLedger(customerId);
  }

  async getGlobalSummary() {
    return this.getFilteredSummary({}, {});
  }

  async getFilteredSummary(filters = {}, settings = {}) {
    const mergedFilters = normalizeFilters(filters);
    const contactParams = [];
    const contactParts = appendCustomerContactFilters(mergedFilters, contactParams, "c");
    const contactWhere = contactParts.length ? contactParts.join(" AND ") : "1=1";

    const summaryParams = [...contactParams];
    const dateFilter = buildSalesDateFilter(mergedFilters, summaryParams, settings, "s.created_at");

    const matchedRow = await queryOne(
      `SELECT COUNT(*) AS customers_matched FROM customers c WHERE ${contactWhere}`,
      contactParams
    );

    const balanceRow = await queryOne(
      `SELECT
         COALESCE(SUM(s.total - COALESCE(s.amount_paid, 0)), 0) AS total_pending,
         COUNT(DISTINCT s.customer_id) AS customers_with_balance
       FROM sales s
       INNER JOIN customers c ON c.id = s.customer_id
       WHERE s.customer_id IS NOT NULL
         AND s.status IN ('completed', 'partial_return')
         AND s.payment_status IN ('pending', 'partial')
         AND (s.total - COALESCE(s.amount_paid, 0)) > 0.01
         AND ${contactWhere}
         ${dateFilter}`,
      summaryParams
    );

    return {
      total_pending: balanceRow?.total_pending ?? 0,
      customers_with_balance: balanceRow?.customers_with_balance ?? 0,
      customers_matched: matchedRow?.customers_matched ?? 0,
    };
  }

  async getById(id) {
    return queryOne("SELECT * FROM customers WHERE id = $1", [id]);
  }

  async create(data) {
    const id = await insert(
      "INSERT INTO customers (name, phone, email, address, notes) VALUES ($1, $2, $3, $4, $5)",
      [data.name, data.phone || null, data.email || null, data.address || null, data.notes || null]
    );
    return this.getById(id);
  }

  async update(id, data) {
    await execute(
      `UPDATE customers SET name = $1, phone = $2, email = $3, address = $4, notes = $5,
       updated_at = datetime('now') WHERE id = $6`,
      [data.name, data.phone || null, data.email || null, data.address || null, data.notes || null, id]
    );
    return this.getById(id);
  }

  async delete(id) {
    const summary = await this.getBalanceSummary(id);
    if (summary.balance_pending > 0.01) {
      throw new Error("Cannot delete a customer with an outstanding balance. Record payment first.");
    }
    await execute("DELETE FROM customers WHERE id = $1", [id]);
    return true;
  }

  async count() {
    const row = await queryOne("SELECT COUNT(*) as total FROM customers");
    return row?.total ?? 0;
  }

  async getAllForExport({
    search = "",
    filters = {},
    settings = {},
    includeBalances = false,
    balanceOnly = false,
  } = {}) {
    const mergedFilters = normalizeFilters({
      ...filters,
      search: filters.search || search,
    });

    if (!includeBalances) {
      const params = [];
      const where = buildCustomerWhereClause(mergedFilters, params);
      return query(`SELECT * FROM customers ${where} ORDER BY name ASC`, params);
    }

    const params = [];
    const balanceJoin = buildBalanceJoinSql(mergedFilters, params, settings);
    let where = buildCustomerWhereClause(mergedFilters, params, "c");

    if (balanceOnly) {
      where += " AND COALESCE(b.balance_pending, 0) > 0";
    }

    return query(
      `SELECT c.*,
              COALESCE(b.total_invoiced, 0) AS total_invoiced,
              COALESCE(b.total_paid, 0) AS total_paid,
              COALESCE(b.balance_pending, 0) AS balance_pending,
              COALESCE(b.pending_count, 0) AS pending_count
       FROM customers c
       ${balanceJoin}
       ${where}
       ORDER BY balance_pending DESC, c.name ASC`,
      params
    );
  }
}

export const customerService = new CustomerService();
