import { query, queryOne, execute, insert } from "../database/connection";
import { inventoryService } from "./InventoryService";
import { generateNumber } from "../utils/format";
import { SALE_STATUS } from "../utils/constants";

class SaleService {
  async getAll({ page = 1, limit = 10, status = null } = {}) {
    let sql = `
      SELECT s.*, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND s.status = $${params.length}`;
    }

    const countRow = await queryOne(
      sql.replace("SELECT s.*, c.name as customer_name", "SELECT COUNT(*) as total"),
      params
    );
    const total = countRow?.total ?? 0;

    sql += " ORDER BY s.created_at DESC";
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push((page - 1) * limit);
    sql += ` OFFSET $${params.length}`;

    const items = await query(sql, params);
    return { items, total, page, limit };
  }

  async getById(id) {
    const sale = await queryOne(
      `SELECT s.*, c.name as customer_name
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.id = $1`,
      [id]
    );
    if (!sale) return null;

    const items = await query(
      `SELECT si.*, p.name AS product_name, p.name_ar, p.barcode
       FROM sale_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1`,
      [id]
    );
    return { ...sale, items };
  }

  async getRecent(limit = 10) {
    return query(
      `SELECT s.*, c.name as customer_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status = 'completed'
       ORDER BY s.created_at DESC LIMIT $1`,
      [limit]
    );
  }

  async getHeldSales() {
    return query(
      `SELECT s.*, c.name as customer_name
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status = 'held' ORDER BY s.updated_at DESC`
    );
  }

  async createSale({ customerId, items, discount, vat, paymentMethod, status = SALE_STATUS.COMPLETED, notes }) {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const total = Math.max(0, subtotal - discount + vat);
    const saleNumber = generateNumber("SALE");

    const saleId = await insert(
      `INSERT INTO sales (sale_number, customer_id, subtotal, discount, vat, total, payment_method, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [saleNumber, customerId || null, subtotal, discount, vat, total, paymentMethod, status, notes || null]
    );

    for (const item of items) {
      await execute(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount, total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [saleId, item.product_id, item.quantity, item.unit_price, item.discount || 0, item.total]
      );

      if (status === SALE_STATUS.COMPLETED) {
        await inventoryService.reduceStock(item.product_id, item.quantity, "sale", saleId);
      }
    }

    if (status === SALE_STATUS.COMPLETED) {
      await execute(
        `INSERT INTO payments (sale_id, amount, payment_method) VALUES ($1, $2, $3)`,
        [saleId, total, paymentMethod]
      );
    }

    const saved = await this.getById(saleId);
    if (saved) return saved;

    throw new Error("Sale saved but could not be loaded. Please refresh and check sales history.");
  }

  async completeHeldSale(saleId, paymentMethod) {
    const sale = await this.getById(saleId);
    if (!sale || sale.status !== SALE_STATUS.HELD) {
      throw new Error("Sale not found or not held");
    }

    for (const item of sale.items ?? []) {
      await inventoryService.reduceStock(item.product_id, item.quantity, "sale", saleId);
    }

    await execute(
      `UPDATE sales SET status = $1, payment_method = $2, updated_at = datetime('now') WHERE id = $3`,
      [SALE_STATUS.COMPLETED, paymentMethod, saleId]
    );
    await execute(
      `INSERT INTO payments (sale_id, amount, payment_method) VALUES ($1, $2, $3)`,
      [saleId, sale.total, paymentMethod]
    );

    return this.getById(saleId);
  }

  async deleteHeldSale(saleId) {
    await execute("DELETE FROM sale_items WHERE sale_id = $1", [saleId]);
    await execute("DELETE FROM sales WHERE id = $1 AND status = 'held'", [saleId]);
    return true;
  }

  async getTodayTotal() {
    const row = await queryOne(
      `SELECT COALESCE(SUM(total), 0) as total FROM sales
       WHERE status = 'completed' AND date(created_at) = date('now')`
    );
    return row?.total ?? 0;
  }

  async getMonthlyRevenue() {
    const row = await queryOne(
      `SELECT COALESCE(SUM(total), 0) as total FROM sales
       WHERE status IN ('completed', 'partial_return', 'returned')
       AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    );
    return row?.total ?? 0;
  }

  _periodFilter(period) {
    if (period === "week") {
      return " AND date(s.created_at) >= date('now', '-6 days')";
    }
    if (period === "month") {
      return " AND strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')";
    }
    return " AND date(s.created_at) = date('now')";
  }

  _returnsPeriodFilter(period) {
    if (period === "week") {
      return " AND date(sr.created_at) >= date('now', '-6 days')";
    }
    if (period === "month") {
      return " AND strftime('%Y-%m', sr.created_at) = strftime('%Y-%m', 'now')";
    }
    return " AND date(sr.created_at) = date('now')";
  }

  async getByPeriod(period = "today") {
    const filter = this._periodFilter(period);
    return query(
      `SELECT s.*, c.name AS customer_name,
              (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status IN ('completed', 'partial_return', 'returned', 'held')
       ${filter}
       ORDER BY s.created_at DESC`
    );
  }

  async getPeriodStats(period = "today") {
    const orders = await this.getByPeriod(period);
    let returnsTotal = 0;
    try {
      const returnsFilter = this._returnsPeriodFilter(period);
      const returnsRow = await queryOne(
        `SELECT COALESCE(SUM(total_refund), 0) AS total FROM sale_returns sr WHERE 1=1 ${returnsFilter}`
      );
      returnsTotal = Number(returnsRow?.total ?? 0);
    } catch {
      returnsTotal = 0;
    }

    const salesTotal = orders
      .filter((o) => o.status !== SALE_STATUS.HELD)
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    return {
      orderCount: orders.filter((o) => o.status !== SALE_STATUS.HELD).length,
      heldCount: orders.filter((o) => o.status === SALE_STATUS.HELD).length,
      salesTotal,
      returnsTotal,
      netTotal: Math.max(0, salesTotal - returnsTotal),
    };
  }

  async getBySaleNumber(saleNumber) {
    const row = await queryOne(
      `SELECT id FROM sales WHERE lower(sale_number) = lower($1)`,
      [saleNumber.trim()]
    );
    if (!row?.id) return null;
    return this.getById(row.id);
  }

  async getReturnsForSale(saleId) {
    try {
      return await query(
        `SELECT sr.*,
                (SELECT GROUP_CONCAT(p.name || ' x' || sri.quantity, ', ')
                 FROM sale_return_items sri
                 LEFT JOIN products p ON p.id = sri.product_id
                 WHERE sri.return_id = sr.id) AS items_summary
         FROM sale_returns sr
         WHERE sr.sale_id = $1
         ORDER BY sr.created_at DESC`,
        [saleId]
      );
    } catch {
      return [];
    }
  }

  async getReturnableItems(saleId) {
    const sale = await this.getById(saleId);
    if (!sale?.items?.length) return null;

    const returnedRows = await query(
      `SELECT sri.product_id, SUM(sri.quantity) AS returned_qty
       FROM sale_return_items sri
       JOIN sale_returns sr ON sr.id = sri.return_id
       WHERE sr.sale_id = $1
       GROUP BY sri.product_id`,
      [saleId]
    );
    const returnedMap = Object.fromEntries(
      returnedRows.map((r) => [r.product_id, Number(r.returned_qty)])
    );

    return sale.items
      .map((item) => {
        const returned = returnedMap[item.product_id] || 0;
        const returnable = Math.max(0, Number(item.quantity) - returned);
        return {
          ...item,
          name: item.product_name || item.name,
          name_ar: item.name_ar,
          returned_qty: returned,
          returnable_qty: returnable,
        };
      })
      .filter((item) => item.returnable_qty > 0);
  }

  async processReturn({ saleId, items, notes }) {
    const sale = await this.getById(saleId);
    if (!sale) throw new Error("Sale not found");
    if (sale.status === SALE_STATUS.HELD) {
      throw new Error("Cannot return a held sale. Complete or cancel it first.");
    }
    if (!items?.length) throw new Error("Select at least one item to return");

    const returnable = await this.getReturnableItems(saleId);
    const returnableMap = Object.fromEntries(
      (returnable || []).map((i) => [i.product_id, i.returnable_qty])
    );

    for (const item of items) {
      const maxQty = returnableMap[item.product_id] ?? 0;
      if (item.quantity <= 0 || item.quantity > maxQty) {
        throw new Error(`Invalid return quantity for ${item.name || "product"}`);
      }
    }

    const totalRefund = items.reduce((sum, i) => sum + i.total, 0);
    const returnNumber = generateNumber("RET");

    const returnId = await insert(
      `INSERT INTO sale_returns (return_number, sale_id, total_refund, notes)
       VALUES ($1, $2, $3, $4)`,
      [returnNumber, saleId, totalRefund, notes || null]
    );

    for (const item of items) {
      await execute(
        `INSERT INTO sale_return_items (return_id, sale_item_id, product_id, quantity, unit_price, total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [returnId, item.sale_item_id || null, item.product_id, item.quantity, item.unit_price, item.total]
      );
      await inventoryService.increaseStock(item.product_id, item.quantity, "return", returnId);
    }

    const remaining = await this.getReturnableItems(saleId);
    const newStatus =
      !remaining?.length ? SALE_STATUS.RETURNED : SALE_STATUS.PARTIAL_RETURN;
    await execute(
      `UPDATE sales SET status = $1, updated_at = datetime('now') WHERE id = $2`,
      [newStatus, saleId]
    );

    return {
      returnId,
      returnNumber,
      totalRefund,
      sale: await this.getById(saleId),
      returns: await this.getReturnsForSale(saleId),
    };
  }
}

export const saleService = new SaleService();
