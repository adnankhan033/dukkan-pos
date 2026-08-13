import { query, queryOne, execute, insert } from "../database/connection";
import { inventoryService } from "./InventoryService";
import { settingsService } from "./SettingsService";
import { zatcaService } from "./ZatcaService";
import { invalidateDashboardCache } from "./DashboardCache";
import { generateNumber, formatInvoiceNumber, parseInvoiceSequence, getPeriodDateRange } from "../utils/format";
import { getBusinessDateTimeISO } from "../utils/businessDate";
import { appendBusinessDateRangeFilter } from "../utils/businessDateFilter";
import { SALE_STATUS } from "../utils/constants";
import { apiClient } from "../api/ApiClient";
import { isDrupalMode, normalizeSale, drupalReturnFilterParam, normalizeProcessReturnResult, normalizeSaleReturn } from "../api/drupalMode";
import { useAuthStore } from "../contexts/store";

async function processZatcaForSale(sale) {
  if (!sale || sale.status !== SALE_STATUS.COMPLETED) return;
  try {
    const settings = await settingsService.getAll();
    await zatcaService.processSale({ sale, items: sale.items, settings });
  } catch (err) {
    console.error("ZATCA processing failed:", err);
  }
}

class SaleService {
  async getNextInvoiceNumber() {
    const rows = await query(`SELECT sale_number FROM sales WHERE sale_number LIKE 'INV-%'`);
    let maxSequence = 0;
    for (const row of rows) {
      const sequence = parseInvoiceSequence(row.sale_number);
      if (sequence != null) {
        maxSequence = Math.max(maxSequence, sequence);
      }
    }
    return formatInvoiceNumber(maxSequence + 1);
  }

  async getAll({ page = 1, limit = 10, status = null } = {}) {
    if (await isDrupalMode()) {
      const result = await apiClient.getSales({ page, limit, status });
      return {
        items: (result.items || []).map(normalizeSale),
        total: result.total ?? 0,
        page: result.page ?? page,
        limit: result.limit ?? limit,
      };
    }

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
    if (await isDrupalMode()) {
      const sale = await apiClient.getSale(Number(id));
      return normalizeSale(sale);
    }

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
    if (await isDrupalMode()) {
      const result = await apiClient.getSales({ page: 1, limit, status: null });
      return (result.items || []).map(normalizeSale);
    }

    return query(
      `SELECT s.*, c.name as customer_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status IN ('completed', 'partial_return', 'returned')
       ORDER BY s.created_at DESC LIMIT $1`,
      [limit]
    );
  }

  async getHeldSales() {
    if (await isDrupalMode()) {
      return [];
    }

    return query(
      `SELECT s.*, c.name as customer_name
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.status = 'held' ORDER BY s.updated_at DESC`
    );
  }

  async createSale({ customerId, items, discount, vat, paymentMethod, status = SALE_STATUS.COMPLETED, notes }) {
    if (await isDrupalMode()) {
      if (status === SALE_STATUS.HELD) {
        throw new Error("Held sales are not supported when connected to Drupal. Complete the sale or use offline mode.");
      }

      const sale = await apiClient.createSale({
        customer_id: customerId || null,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount || 0,
          total: item.total,
        })),
        discount: discount || 0,
        vat: vat || 0,
        payment_method: paymentMethod,
        status,
        notes: notes || null,
      });
      const saved = normalizeSale(sale);
      if (saved && status === SALE_STATUS.COMPLETED) {
        await processZatcaForSale(saved);
        invalidateDashboardCache();
      }
      return saved;
    }

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const total = Math.max(0, subtotal - discount + vat);
    const saleNumber = await this.getNextInvoiceNumber();
    const settings = await settingsService.getAll();
    const createdAt = getBusinessDateTimeISO(settings);
    const { user, terminal } = useAuthStore.getState();
    const cashierId = user?.id ?? null;
    const terminalId = terminal?.id ?? null;

    const saleId = await insert(
      `INSERT INTO sales (sale_number, customer_id, cashier_id, terminal_id, subtotal, discount, vat, total, payment_method, status, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        saleNumber,
        customerId || null,
        cashierId,
        terminalId,
        subtotal,
        discount,
        vat,
        total,
        paymentMethod,
        status,
        notes || null,
        createdAt,
      ]
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
    if (saved) {
      if (status === SALE_STATUS.COMPLETED) {
        await processZatcaForSale(saved);
        invalidateDashboardCache();
      }
      return saved;
    }

    throw new Error("Sale saved but could not be loaded. Please refresh and check sales history.");
  }

  async completeHeldSale(saleId, paymentMethod) {
    if (await isDrupalMode()) {
      throw new Error("Held sales are not available when connected to Drupal.");
    }

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

    const completed = await this.getById(saleId);
    if (completed) {
      await processZatcaForSale(completed);
      invalidateDashboardCache();
    }
    return completed;
  }

  async deleteHeldSale(saleId) {
    if (await isDrupalMode()) {
      throw new Error("Held sales are not available when connected to Drupal.");
    }

    await execute("DELETE FROM sale_items WHERE sale_id = $1", [saleId]);
    await execute("DELETE FROM sales WHERE id = $1 AND status = 'held'", [saleId]);
    return true;
  }

  async deleteSale(saleId) {
    if (await isDrupalMode()) {
      throw new Error("Deleting orders is not supported when connected to Drupal. Manage orders in the backend admin.");
    }

    const numId = Number(saleId);
    const sale = await this.getById(numId);
    if (!sale) {
      throw new Error("Order not found");
    }

    if (sale.status !== SALE_STATUS.HELD && sale.items?.length) {
      const returnedRows = await query(
        `SELECT sri.product_id, SUM(sri.quantity) AS returned_qty
         FROM sale_return_items sri
         JOIN sale_returns sr ON sr.id = sri.return_id
         WHERE sr.sale_id = $1
         GROUP BY sri.product_id`,
        [numId]
      );
      const returnedMap = Object.fromEntries(
        returnedRows.map((row) => [row.product_id, Number(row.returned_qty)])
      );

      for (const item of sale.items) {
        const returned = returnedMap[item.product_id] || 0;
        const netSold = Math.max(0, Number(item.quantity) - returned);
        if (netSold > 0) {
          await inventoryService.increaseStock(
            item.product_id,
            netSold,
            "order_delete",
            numId
          );
        }
      }
    }

    const returns = await query("SELECT id FROM sale_returns WHERE sale_id = $1", [numId]);
    for (const row of returns) {
      await execute("DELETE FROM sale_return_items WHERE return_id = $1", [row.id]);
    }
    await execute("DELETE FROM sale_returns WHERE sale_id = $1", [numId]);
    await execute("DELETE FROM zatca_invoices WHERE sale_id = $1", [numId]);
    await execute("DELETE FROM payments WHERE sale_id = $1", [numId]);
    await execute("DELETE FROM sale_items WHERE sale_id = $1", [numId]);
    await execute("DELETE FROM sales WHERE id = $1", [numId]);

    const stillExists = await queryOne("SELECT id FROM sales WHERE id = $1", [numId]);
    if (stillExists) {
      throw new Error(`Failed to delete order ${sale.sale_number}`);
    }

    return true;
  }

  async deleteMany(ids) {
    const deleted = [];
    const failed = [];

    for (const id of ids) {
      try {
        await this.deleteSale(id);
        deleted.push(Number(id));
      } catch (err) {
        failed.push({ id: Number(id), message: err.message || "Delete failed" });
      }
    }

    return { deleted, failed };
  }

  async getTodayTotal() {
    const gross = await this.getTodayGrossSales();
    const returns = await this.getTodayReturnsTotal();
    return Math.max(0, gross - returns);
  }

  async getTodayGrossSales() {
    if (await isDrupalMode()) {
      const range = getPeriodDateRange("daily");
      const stats = await apiClient.getSalesStats({ from: range.from, to: range.to });
      return stats.salesTotal;
    }

    const row = await queryOne(
      `SELECT COALESCE(SUM(total), 0) as total FROM sales
       WHERE status IN ('completed', 'partial_return', 'returned')
       AND date(created_at) = date('now')`
    );
    return Number(row?.total ?? 0);
  }

  async getTodayReturnsTotal() {
    const row = await queryOne(
      `SELECT COALESCE(SUM(total_refund), 0) as total FROM sale_returns
       WHERE date(created_at) = date('now')`
    );
    return Number(row?.total ?? 0);
  }

  async getMonthlyReturnsTotal() {
    const row = await queryOne(
      `SELECT COALESCE(SUM(total_refund), 0) as total FROM sale_returns
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    );
    return Number(row?.total ?? 0);
  }

  async getMonthlyGrossSales() {
    if (await isDrupalMode()) {
      const range = getPeriodDateRange("monthly");
      const stats = await apiClient.getSalesStats({ from: range.from, to: range.to });
      return stats.salesTotal;
    }

    const row = await queryOne(
      `SELECT COALESCE(SUM(total), 0) as total FROM sales
       WHERE status IN ('completed', 'partial_return', 'returned')
       AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    );
    return Number(row?.total ?? 0);
  }

  async getMonthlyRevenue() {
    const gross = await this.getMonthlyGrossSales();
    const returns = await this.getMonthlyReturnsTotal();
    return Math.max(0, gross - returns);
  }

  async getRecentReturns(limit = 8) {
    try {
      return await query(
        `SELECT sr.*, s.sale_number, c.name AS customer_name
         FROM sale_returns sr
         JOIN sales s ON s.id = sr.sale_id
         LEFT JOIN customers c ON c.id = s.customer_id
         ORDER BY sr.created_at DESC
         LIMIT $1`,
        [limit]
      );
    } catch {
      return [];
    }
  }

  _resolveDateRange(period, from, to) {
    if (from && to) return { from, to };
    if (period === "week") return getPeriodDateRange("weekly");
    if (period === "month") return getPeriodDateRange("monthly");
    return getPeriodDateRange("daily");
  }

  _appendDateRangeFilter(column, range, params, settings) {
    return appendBusinessDateRangeFilter(column, range, params, settings);
  }

  _buildOrdersQueryFilters(period, returnFilter = "all", search = "", from = null, to = null, settings = {}) {
    let where = `WHERE s.status IN ('completed', 'partial_return', 'returned', 'held')`;
    const params = [];
    const range = this._resolveDateRange(period, from, to);
    where += this._appendDateRangeFilter("s.created_at", range, params, settings);

    if (returnFilter === "no_return") {
      where += " AND s.status = 'completed'";
    } else if (returnFilter === "with_return") {
      where += " AND s.status IN ('partial_return', 'returned')";
    } else if (returnFilter === "partial_return") {
      where += " AND s.status = 'partial_return'";
    } else if (returnFilter === "returned") {
      where += " AND s.status = 'returned'";
    }

    const term = search.trim();
    if (term) {
      params.push(`%${term}%`);
      where += ` AND (s.sale_number LIKE $${params.length} OR COALESCE(c.name, '') LIKE $${params.length} OR COALESCE(s.payment_method, '') LIKE $${params.length})`;
    }

    return { where, params };
  }

  async getByPeriodPaginated({
    period = "today",
    from = null,
    to = null,
    page = 1,
    limit = 100,
    returnFilter = "all",
    search = "",
  } = {}) {
    if (await isDrupalMode()) {
      const range = this._resolveDateRange(period, from, to);
      const returnFilterParam = drupalReturnFilterParam(returnFilter);
      const result = await apiClient.getSales({
        page,
        limit,
        from: range.from,
        to: range.to,
        search: search.trim() || undefined,
        return_filter: returnFilterParam,
      });
      return {
        items: (result.items || []).map(normalizeSale),
        total: Number(result.total ?? 0),
        page: result.page ?? page,
        limit: result.limit ?? limit,
      };
    }

    const settings = await settingsService.getAll();
    const { where, params } = this._buildOrdersQueryFilters(
      period,
      returnFilter,
      search,
      from,
      to,
      settings
    );
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Number(limit) || 100);
    const offset = (safePage - 1) * safeLimit;
    const countParams = [...params];

    const [countRow, items] = await Promise.all([
      queryOne(
        `SELECT COUNT(*) AS total
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         ${where}`,
        countParams
      ),
      query(
        `SELECT s.*, c.name AS customer_name,
                (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         ${where}
         ORDER BY s.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, safeLimit, offset]
      ),
    ]);

    return {
      items,
      total: Number(countRow?.total ?? 0),
      page: safePage,
      limit: safeLimit,
    };
  }

  async getByPeriod(period = "today") {
    const result = await this.getByPeriodPaginated({ period, page: 1, limit: 100000 });
    return result.items;
  }

  async getPeriodStats(period = "today", from = null, to = null) {
    if (await isDrupalMode()) {
      const range = this._resolveDateRange(period, from, to);
      return apiClient.getSalesStats({ from: range.from, to: range.to });
    }

    const settings = await settingsService.getAll();
    const range = this._resolveDateRange(period, from, to);
    const salesParams = [];
    const periodFilter = this._appendDateRangeFilter("s.created_at", range, salesParams, settings);
    const salesRow = await queryOne(
      `SELECT
         COUNT(CASE WHEN s.status != 'held' THEN 1 END) AS order_count,
         COUNT(CASE WHEN s.status = 'held' THEN 1 END) AS held_count,
         COALESCE(SUM(CASE WHEN s.status != 'held' THEN s.total ELSE 0 END), 0) AS sales_total
       FROM sales s
       WHERE s.status IN ('completed', 'partial_return', 'returned', 'held')
       ${periodFilter}`,
      salesParams
    );

    let returnsTotal = 0;
    try {
      const returnsParams = [];
      const returnsFilter = this._appendDateRangeFilter("sr.created_at", range, returnsParams, settings);
      const returnsRow = await queryOne(
        `SELECT COALESCE(SUM(total_refund), 0) AS total FROM sale_returns sr WHERE 1=1 ${returnsFilter}`,
        returnsParams
      );
      returnsTotal = Number(returnsRow?.total ?? 0);
    } catch {
      returnsTotal = 0;
    }

    const salesTotal = Number(salesRow?.sales_total ?? 0);

    return {
      orderCount: Number(salesRow?.order_count ?? 0),
      heldCount: Number(salesRow?.held_count ?? 0),
      salesTotal,
      returnsTotal,
      netTotal: Math.max(0, salesTotal - returnsTotal),
    };
  }

  async getBySaleNumber(saleNumber) {
    if (await isDrupalMode()) {
      try {
        const sale = await apiClient.getSaleByNumber(saleNumber.trim());
        return normalizeSale(sale);
      } catch (err) {
        if (err.message?.includes("not found")) return null;
        throw err;
      }
    }

    const row = await queryOne(
      `SELECT id FROM sales WHERE lower(sale_number) = lower($1)`,
      [saleNumber.trim()]
    );
    if (!row?.id) return null;
    return this.getById(row.id);
  }

  async getReturnsForSale(saleId) {
    if (await isDrupalMode()) {
      const items = await apiClient.getSaleReturns(Number(saleId));
      return items.map(normalizeSaleReturn);
    }

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
    if (await isDrupalMode()) {
      const items = await apiClient.getReturnableItems(Number(saleId));
      return items.map((item) => ({
        ...item,
        id: Number(item.id),
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        returned_qty: Number(item.returned_qty ?? 0),
        returnable_qty: Number(item.returnable_qty ?? 0),
        name: item.product_name || item.name,
      }));
    }

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

    const soldByProduct = new Map();
    const lineByProduct = new Map();
    for (const item of sale.items) {
      const productId = Number(item.product_id);
      soldByProduct.set(productId, (soldByProduct.get(productId) || 0) + Number(item.quantity));
      if (!lineByProduct.has(productId)) {
        lineByProduct.set(productId, item);
      }
    }

    return [...soldByProduct.entries()]
      .map(([productId, soldQty]) => {
        const returned = returnedMap[productId] || 0;
        const returnable = Math.max(0, soldQty - returned);
        const line = lineByProduct.get(productId);
        return {
          ...line,
          product_id: productId,
          quantity: soldQty,
          name: line.product_name || line.name,
          name_ar: line.name_ar,
          returned_qty: returned,
          returnable_qty: returnable,
        };
      })
      .filter((item) => item.returnable_qty > 0);
  }

  async processReturn({ saleId, items, notes }) {
    if (await isDrupalMode()) {
      const result = await apiClient.processSaleReturn(Number(saleId), {
        items: items.map((item) => ({
          sale_item_id: item.sale_item_id || null,
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        })),
        notes: notes || null,
      });
      invalidateDashboardCache();
      return normalizeProcessReturnResult(result);
    }

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

    invalidateDashboardCache();

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
