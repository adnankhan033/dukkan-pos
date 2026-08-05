import { query, queryOne, execute, insert } from "../database/connection";
import { purchaseService } from "./PurchaseService";

class SupplierService {
  async getAll({ search = "", page = 1, limit = 10 } = {}) {
    let sql = "SELECT * FROM suppliers WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (company LIKE $${params.length} OR contact_person LIKE $${params.length} OR phone LIKE $${params.length})`;
    }

    const countRow = await queryOne(sql.replace("SELECT *", "SELECT COUNT(*) as total"), params);
    const total = countRow?.total ?? 0;

    sql += " ORDER BY company ASC";
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push((page - 1) * limit);
    sql += ` OFFSET $${params.length}`;

    const items = await query(sql, params);
    return { items, total, page, limit };
  }

  async getAllWithBalances({ search = "", page = 1, limit = 10 } = {}) {
    let where = "WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (s.company LIKE $${params.length} OR s.contact_person LIKE $${params.length} OR s.phone LIKE $${params.length})`;
    }

    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM suppliers s ${where}`,
      params
    );
    const total = countRow?.total ?? 0;

    const balanceParams = [...params, limit, (page - 1) * limit];
    const items = await query(
      `SELECT s.*,
              COALESCE(b.total_delivered, 0) AS total_delivered,
              COALESCE(b.total_paid, 0) AS total_paid,
              COALESCE(b.balance_pending, 0) AS balance_pending,
              COALESCE(b.pending_count, 0) AS pending_count
       FROM suppliers s
       LEFT JOIN (
         SELECT supplier_id,
                SUM(total) AS total_delivered,
                SUM(COALESCE(amount_paid, 0)) AS total_paid,
                SUM(total - COALESCE(amount_paid, 0)) AS balance_pending,
                SUM(CASE WHEN payment_status IN ('pending', 'partial') THEN 1 ELSE 0 END) AS pending_count
         FROM purchases
         WHERE supplier_id IS NOT NULL
         GROUP BY supplier_id
       ) b ON b.supplier_id = s.id
       ${where}
       ORDER BY balance_pending DESC, s.company ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      balanceParams
    );

    return { items, total, page, limit };
  }

  async getBalanceSummary(supplierId) {
    const row = await queryOne(
      `SELECT
         COALESCE(SUM(total), 0) AS total_delivered,
         COALESCE(SUM(amount_paid), 0) AS total_paid,
         COALESCE(SUM(total - COALESCE(amount_paid, 0)), 0) AS balance_pending,
         SUM(CASE WHEN payment_status IN ('pending', 'partial') THEN 1 ELSE 0 END) AS pending_deliveries
       FROM purchases
       WHERE supplier_id = $1`,
      [supplierId]
    );
    return {
      total_delivered: row?.total_delivered ?? 0,
      total_paid: row?.total_paid ?? 0,
      balance_pending: row?.balance_pending ?? 0,
      pending_deliveries: row?.pending_deliveries ?? 0,
    };
  }

  async getLedger(supplierId) {
    const [summary, deliveries, payments] = await Promise.all([
      this.getBalanceSummary(supplierId),
      query(
        `SELECT p.id, p.purchase_number, p.total, p.amount_paid,
                (p.total - COALESCE(p.amount_paid, 0)) AS balance_due,
                p.payment_status, p.purchase_type, p.due_date, p.notes, p.created_at
         FROM purchases p
         WHERE p.supplier_id = $1
         ORDER BY p.created_at DESC`,
        [supplierId]
      ),
      query(
        `SELECT sp.*, p.purchase_number
         FROM supplier_payments sp
         LEFT JOIN purchases p ON sp.purchase_id = p.id
         WHERE sp.supplier_id = $1
         ORDER BY sp.payment_date DESC, sp.created_at DESC`,
        [supplierId]
      ),
    ]);

    return { summary, deliveries, payments };
  }

  async getProductsBySupplier(supplierId) {
    return query(
      `SELECT p.id, p.name, p.sku, p.barcode, p.cost_price, p.quantity, p.updated_at
       FROM products p
       WHERE p.supplier_id = $1
       ORDER BY p.name ASC`,
      [supplierId]
    );
  }

  async recordPayment({ supplierId, amount, notes, purchaseId = null, paymentDate = null }) {
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      throw new Error("Enter a valid payment amount");
    }

    const summary = await this.getBalanceSummary(supplierId);
    if (payAmount > summary.balance_pending + 0.01) {
      throw new Error(`Payment exceeds pending balance (${summary.balance_pending.toFixed(2)})`);
    }

    const date = paymentDate || new Date().toISOString().slice(0, 10);
    let remaining = payAmount;

    if (purchaseId) {
      const applied = await purchaseService.applyPaymentToPurchase(purchaseId, remaining);
      remaining -= applied;

      await insert(
        `INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_date, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [supplierId, purchaseId, applied, date, notes || null]
      );
    } else {
      const pending = await purchaseService.getPendingBySupplier(supplierId);
      let totalRecorded = 0;

      for (const po of pending) {
        if (remaining <= 0) break;
        const applied = await purchaseService.applyPaymentToPurchase(po.id, remaining);
        if (applied <= 0) continue;

        await insert(
          `INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_date, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [supplierId, po.id, applied, date, notes || null]
        );

        remaining -= applied;
        totalRecorded += applied;
      }

      if (totalRecorded <= 0) {
        throw new Error("No pending balance to pay");
      }
    }

    return this.getLedger(supplierId);
  }

  async getGlobalSummary() {
    const row = await queryOne(
      `SELECT
         COALESCE(SUM(total - COALESCE(amount_paid, 0)), 0) AS total_pending,
         COUNT(DISTINCT supplier_id) AS suppliers_with_balance
       FROM purchases
       WHERE supplier_id IS NOT NULL
         AND payment_status IN ('pending', 'partial')`
    );
    return {
      total_pending: row?.total_pending ?? 0,
      suppliers_with_balance: row?.suppliers_with_balance ?? 0,
    };
  }

  async getAllForExport({ search = "" } = {}) {
    let where = "WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (s.company LIKE $${params.length} OR s.contact_person LIKE $${params.length} OR s.phone LIKE $${params.length} OR s.email LIKE $${params.length})`;
    }

    return query(
      `SELECT s.*,
              COALESCE(b.total_delivered, 0) AS total_delivered,
              COALESCE(b.total_paid, 0) AS total_paid,
              COALESCE(b.balance_pending, 0) AS balance_pending
       FROM suppliers s
       LEFT JOIN (
         SELECT supplier_id,
                SUM(total) AS total_delivered,
                SUM(COALESCE(amount_paid, 0)) AS total_paid,
                SUM(total - COALESCE(amount_paid, 0)) AS balance_pending
         FROM purchases
         WHERE supplier_id IS NOT NULL
         GROUP BY supplier_id
       ) b ON b.supplier_id = s.id
       ${where}
       ORDER BY s.company ASC`,
      params
    );
  }

  async getById(id) {
    return queryOne("SELECT * FROM suppliers WHERE id = $1", [id]);
  }

  async create(data) {
    const id = await insert(
      "INSERT INTO suppliers (company, contact_person, phone, email, address) VALUES ($1, $2, $3, $4, $5)",
      [data.company, data.contact_person || null, data.phone || null, data.email || null, data.address || null]
    );
    return this.getById(id);
  }

  async update(id, data) {
    await execute(
      `UPDATE suppliers SET company = $1, contact_person = $2, phone = $3, email = $4, address = $5,
       updated_at = datetime('now') WHERE id = $6`,
      [data.company, data.contact_person || null, data.phone || null, data.email || null, data.address || null, id]
    );
    return this.getById(id);
  }

  async delete(id) {
    const summary = await this.getBalanceSummary(id);
    if (summary.balance_pending > 0) {
      throw new Error("Cannot delete supplier with pending balance. Record payments first.");
    }
    await execute("DELETE FROM suppliers WHERE id = $1", [id]);
    return true;
  }
}

export const supplierService = new SupplierService();
