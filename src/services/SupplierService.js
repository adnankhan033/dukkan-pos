import { query, queryOne, execute, insert } from "../database/connection";
import { purchaseService } from "./PurchaseService";
import { accountingService, safeAccountingPost } from "./AccountingService";

const PURCHASE_BALANCE_SQL = `
  SELECT supplier_id,
         SUM(total) AS total_delivered,
         SUM(COALESCE(amount_paid, 0)) AS purchase_paid,
         SUM(total - COALESCE(amount_paid, 0)) AS purchase_due,
         SUM(CASE WHEN payment_status IN ('pending', 'partial') THEN 1 ELSE 0 END) AS pending_count
  FROM purchases
  WHERE supplier_id IS NOT NULL
  GROUP BY supplier_id
`;

const ADVANCE_BALANCE_SQL = `
  SELECT supplier_id, COALESCE(SUM(amount), 0) AS advance_balance
  FROM supplier_payments
  WHERE purchase_id IS NULL
  GROUP BY supplier_id
`;

function withNetBalance(row = {}) {
  const totalDelivered = Number(row.total_delivered || 0);
  const purchasePaid = Number(row.purchase_paid || row.total_paid || 0);
  const purchaseDue = Number(row.purchase_due || row.balance_pending || 0);
  const advanceBalance = Number(row.advance_balance || 0);
  const totalPaid = purchasePaid + advanceBalance;
  const balancePending = purchaseDue - advanceBalance;
  return {
    ...row,
    total_delivered: totalDelivered,
    total_paid: totalPaid,
    purchase_due: purchaseDue,
    advance_balance: advanceBalance,
    balance_pending: balancePending,
  };
}

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
              COALESCE(b.purchase_paid, 0) AS purchase_paid,
              COALESCE(b.purchase_due, 0) AS purchase_due,
              COALESCE(b.pending_count, 0) AS pending_count,
              COALESCE(a.advance_balance, 0) AS advance_balance
       FROM suppliers s
       LEFT JOIN (${PURCHASE_BALANCE_SQL}) b ON b.supplier_id = s.id
       LEFT JOIN (${ADVANCE_BALANCE_SQL}) a ON a.supplier_id = s.id
       ${where}
       ORDER BY (COALESCE(b.purchase_due, 0) - COALESCE(a.advance_balance, 0)) DESC, s.company ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      balanceParams
    );

    return { items: items.map(withNetBalance), total, page, limit };
  }

  async getBalanceSummary(supplierId) {
    const [purchases, advance] = await Promise.all([
      queryOne(
        `SELECT
           COALESCE(SUM(total), 0) AS total_delivered,
           COALESCE(SUM(amount_paid), 0) AS purchase_paid,
           COALESCE(SUM(total - COALESCE(amount_paid, 0)), 0) AS purchase_due,
           SUM(CASE WHEN payment_status IN ('pending', 'partial') THEN 1 ELSE 0 END) AS pending_deliveries
         FROM purchases
         WHERE supplier_id = $1`,
        [supplierId]
      ),
      queryOne(
        `SELECT COALESCE(SUM(amount), 0) AS advance_balance
         FROM supplier_payments
         WHERE supplier_id = $1 AND purchase_id IS NULL`,
        [supplierId]
      ),
    ]);
    const summary = withNetBalance({
      total_delivered: purchases?.total_delivered ?? 0,
      purchase_paid: purchases?.purchase_paid ?? 0,
      purchase_due: purchases?.purchase_due ?? 0,
      advance_balance: advance?.advance_balance ?? 0,
    });
    return {
      ...summary,
      pending_deliveries: purchases?.pending_deliveries ?? 0,
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

  async recordCashPayment({ supplierId, purchaseId = null, amount, date, notes, purchaseNumber = null }) {
    const payAmount = Number(amount);
    if (payAmount <= 0.01) return null;
    const payRowId = await insert(
      `INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_date, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [supplierId, purchaseId, payAmount, date, notes || null]
    );
    await safeAccountingPost(() =>
      accountingService.postSupplierPayment({
        paymentId: payRowId,
        supplierId,
        amount: payAmount,
        purchaseNumber,
      })
    );
    return payRowId;
  }

  async recordPayment({ supplierId, amount, notes, purchaseId = null, paymentDate = null }) {
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      throw new Error("Enter a valid payment amount");
    }

    const date = paymentDate || new Date().toISOString().slice(0, 10);
    let remaining = payAmount;
    const skippedId = purchaseId ? Number(purchaseId) : null;

    if (skippedId) {
      const applied = await purchaseService.applyPaymentToPurchase(skippedId, remaining);
      if (applied > 0.01) {
        const purchase = await purchaseService.getById(skippedId);
        remaining -= applied;
        await this.recordCashPayment({
          supplierId,
          purchaseId: skippedId,
          amount: applied,
          date,
          notes,
          purchaseNumber: purchase?.purchase_number,
        });
      }
    }

    const pending = await purchaseService.getPendingBySupplier(supplierId);
    for (const po of pending) {
      if (remaining <= 0.01) break;
      if (skippedId && Number(po.id) === skippedId) continue;
      const applied = await purchaseService.applyPaymentToPurchase(po.id, remaining);
      if (applied <= 0.01) continue;
      remaining -= applied;
      await this.recordCashPayment({
        supplierId,
        purchaseId: po.id,
        amount: applied,
        date,
        notes,
        purchaseNumber: po.purchase_number,
      });
    }

    if (remaining > 0.01) {
      await this.recordCashPayment({
        supplierId,
        purchaseId: null,
        amount: remaining,
        date,
        notes: notes || "Advance payment",
        purchaseNumber: "advance",
      });
    }

    return this.getLedger(supplierId);
  }

  async getGlobalSummary() {
    const [row, aging] = await Promise.all([
      queryOne(
        `SELECT
           COALESCE(SUM(CASE WHEN net_due > 0 THEN net_due ELSE 0 END), 0) AS total_pending,
           COALESCE(SUM(CASE WHEN net_due < 0 THEN -net_due ELSE 0 END), 0) AS total_advance,
           SUM(CASE WHEN net_due > 0.01 THEN 1 ELSE 0 END) AS suppliers_with_balance,
           SUM(CASE WHEN net_due < -0.01 THEN 1 ELSE 0 END) AS suppliers_with_advance,
           COALESCE(SUM(total_delivered), 0) AS total_delivered,
           COALESCE(SUM(purchase_paid + advance_balance), 0) AS total_paid
         FROM (
           SELECT
             COALESCE(b.total_delivered, 0) AS total_delivered,
             COALESCE(b.purchase_paid, 0) AS purchase_paid,
             COALESCE(a.advance_balance, 0) AS advance_balance,
             COALESCE(b.purchase_due, 0) - COALESCE(a.advance_balance, 0) AS net_due
           FROM suppliers s
           LEFT JOIN (${PURCHASE_BALANCE_SQL}) b ON b.supplier_id = s.id
           LEFT JOIN (${ADVANCE_BALANCE_SQL}) a ON a.supplier_id = s.id
         ) AS nets`
      ),
      queryOne(
        `SELECT
           COALESCE(SUM(CASE WHEN days <= 15 THEN due ELSE 0 END), 0) AS d0_15,
           COALESCE(SUM(CASE WHEN days > 15 AND days <= 30 THEN due ELSE 0 END), 0) AS d15_30,
           COALESCE(SUM(CASE WHEN days > 30 AND days <= 60 THEN due ELSE 0 END), 0) AS d30_60,
           COALESCE(SUM(CASE WHEN days > 60 AND days <= 90 THEN due ELSE 0 END), 0) AS d60_90,
           COALESCE(SUM(CASE WHEN days > 90 THEN due ELSE 0 END), 0) AS over90
         FROM (
           SELECT
             CAST(julianday('now', 'localtime') - julianday(date(created_at)) AS INTEGER) AS days,
             (total - COALESCE(amount_paid, 0)) AS due
           FROM purchases
           WHERE supplier_id IS NOT NULL
             AND payment_status IN ('pending', 'partial')
             AND (total - COALESCE(amount_paid, 0)) > 0
         ) AS aged`
      ),
    ]);
    return {
      total_pending: Number(row?.total_pending || 0),
      total_advance: Number(row?.total_advance || 0),
      suppliers_with_balance: Number(row?.suppliers_with_balance || 0),
      suppliers_with_advance: Number(row?.suppliers_with_advance || 0),
      total_delivered: Number(row?.total_delivered || 0),
      total_paid: Number(row?.total_paid || 0),
      aging: {
        d0_15: Number(aging?.d0_15 || 0),
        d15_30: Number(aging?.d15_30 || 0),
        d30_60: Number(aging?.d30_60 || 0),
        d60_90: Number(aging?.d60_90 || 0),
        over90: Number(aging?.over90 || 0),
      },
    };
  }

  async getAllForExport({ search = "" } = {}) {
    let where = "WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (s.company LIKE $${params.length} OR s.contact_person LIKE $${params.length} OR s.phone LIKE $${params.length} OR s.email LIKE $${params.length})`;
    }

    const rows = await query(
      `SELECT s.*,
              COALESCE(b.total_delivered, 0) AS total_delivered,
              COALESCE(b.purchase_paid, 0) AS purchase_paid,
              COALESCE(b.purchase_due, 0) AS purchase_due,
              COALESCE(a.advance_balance, 0) AS advance_balance
       FROM suppliers s
       LEFT JOIN (${PURCHASE_BALANCE_SQL}) b ON b.supplier_id = s.id
       LEFT JOIN (${ADVANCE_BALANCE_SQL}) a ON a.supplier_id = s.id
       ${where}
       ORDER BY s.company ASC`,
      params
    );
    return rows.map(withNetBalance);
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
    if (summary.balance_pending > 0.01) {
      throw new Error("Cannot delete supplier with pending balance. Record payments first.");
    }
    if (summary.advance_balance > 0.01) {
      throw new Error("Cannot delete supplier with an unused advance. Apply it to a delivery first.");
    }
    await execute("DELETE FROM suppliers WHERE id = $1", [id]);
    return true;
  }
}

export const supplierService = new SupplierService();
