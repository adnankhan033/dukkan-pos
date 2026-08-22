import { query, queryOne, execute, insert } from "../database/connection";
import { inventoryService } from "./InventoryService";
import { generateNumber } from "../utils/format";
import { PURCHASE_PAYMENT_STATUS, PURCHASE_TYPE } from "../utils/constants";
import { accountingService, safeAccountingPost } from "./AccountingService";

class PurchaseService {
  async getAll({ page = 1, limit = 10, supplierId = null, paymentStatus = null } = {}) {
    let sql = `
      SELECT p.*, s.company as supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (supplierId) {
      params.push(Number(supplierId));
      sql += ` AND p.supplier_id = $${params.length}`;
    }

    if (paymentStatus) {
      params.push(paymentStatus);
      sql += ` AND p.payment_status = $${params.length}`;
    }

    const countRow = await queryOne(
      sql.replace("SELECT p.*, s.company as supplier_name", "SELECT COUNT(*) as total"),
      params
    );
    const total = countRow?.total ?? 0;

    sql += " ORDER BY p.created_at DESC";
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push((page - 1) * limit);
    sql += ` OFFSET $${params.length}`;

    const items = await query(sql, params);
    return { items, total, page, limit };
  }

  async getById(id) {
    const purchase = await queryOne(
      `SELECT p.*, s.company as supplier_name
       FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = $1`,
      [id]
    );
    if (!purchase) return null;

    const items = await query(
      `SELECT pi.*, pr.name as product_name
       FROM purchase_items pi
       JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = $1`,
      [id]
    );
    return { ...purchase, items };
  }

  async getPendingBySupplier(supplierId) {
    return query(
      `SELECT p.*, (p.total - COALESCE(p.amount_paid, 0)) AS balance_due
       FROM purchases p
       WHERE p.supplier_id = $1
         AND p.payment_status IN ($2, $3)
         AND (p.total - COALESCE(p.amount_paid, 0)) > 0
       ORDER BY p.created_at ASC`,
      [supplierId, PURCHASE_PAYMENT_STATUS.PENDING, PURCHASE_PAYMENT_STATUS.PARTIAL]
    );
  }

  async create({ supplierId, items, notes, purchaseType = PURCHASE_TYPE.MARKET, dueDate = null }) {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const purchaseNumber = generateNumber("PO");

    const isCredit = purchaseType === PURCHASE_TYPE.SUPPLIER_CREDIT;
    const isSupplier = purchaseType !== PURCHASE_TYPE.MARKET;

    if (isSupplier && !supplierId) {
      throw new Error("Select a supplier for supplier purchases");
    }

    const paymentStatus = isCredit ? PURCHASE_PAYMENT_STATUS.PENDING : PURCHASE_PAYMENT_STATUS.PAID;
    const amountPaid = isCredit ? 0 : subtotal;

    const purchaseId = await insert(
      `INSERT INTO purchases (
         purchase_number, supplier_id, subtotal, total, notes,
         purchase_type, payment_status, amount_paid, due_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        purchaseNumber,
        supplierId || null,
        subtotal,
        subtotal,
        notes || null,
        purchaseType,
        paymentStatus,
        amountPaid,
        dueDate || null,
      ]
    );

    for (const item of items) {
      await execute(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, total)
         VALUES ($1, $2, $3, $4, $5)`,
        [purchaseId, item.product_id, item.quantity, item.unit_cost, item.total]
      );

      await inventoryService.increaseStock(item.product_id, item.quantity, "purchase", purchaseId);

      await execute(
        "UPDATE products SET cost_price = $1, updated_at = datetime('now') WHERE id = $2",
        [item.unit_cost, item.product_id]
      );

      if (supplierId) {
        await execute(
          "UPDATE products SET supplier_id = $1, updated_at = datetime('now') WHERE id = $2",
          [supplierId, item.product_id]
        );
      }
    }

    if (!isCredit && subtotal > 0) {
      await execute(
        `INSERT INTO payments (purchase_id, amount, payment_method, notes) VALUES ($1, $2, $3, $4)`,
        [purchaseId, subtotal, "cash", isSupplier ? "Supplier purchase — paid" : "Market purchase"]
      );
    }

    const saved = await this.getById(purchaseId);
    await safeAccountingPost(() => accountingService.postPurchase(saved));
    if (isCredit && supplierId) {
      await this.applyUnallocatedAdvances(supplierId, purchaseId);
    }
    await safeAccountingPost(() => accountingService.syncInventoryBookToStock());
    return this.getById(purchaseId);
  }

  /** Apply prepaid supplier cash (purchase_id IS NULL) to a delivery. No new cash journal. */
  async applyUnallocatedAdvances(supplierId, purchaseId) {
    if (!supplierId || !purchaseId) return 0;

    const purchase = await queryOne("SELECT * FROM purchases WHERE id = $1", [purchaseId]);
    if (!purchase) return 0;

    let due = Number(purchase.total || 0) - Number(purchase.amount_paid || 0);
    if (due <= 0.01) return 0;

    const advances = await query(
      `SELECT * FROM supplier_payments
       WHERE supplier_id = $1 AND purchase_id IS NULL AND amount > 0.01
       ORDER BY payment_date ASC, id ASC`,
      [supplierId]
    );

    let appliedTotal = 0;
    for (const advance of advances) {
      if (due <= 0.01) break;
      const take = Math.min(Number(advance.amount) || 0, due);
      const applied = await this.applyPaymentToPurchase(purchaseId, take);
      if (applied <= 0) break;

      const leftover = Number(advance.amount) - applied;
      const note = `Advance applied to ${purchase.purchase_number}`;
      if (leftover <= 0.01) {
        await execute(
          `UPDATE supplier_payments SET purchase_id = $1,
             notes = CASE WHEN notes IS NULL OR notes = '' THEN $2 ELSE notes END
           WHERE id = $3`,
          [purchaseId, note, advance.id]
        );
      } else {
        await execute("UPDATE supplier_payments SET amount = $1 WHERE id = $2", [leftover, advance.id]);
        await insert(
          `INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_date, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [supplierId, purchaseId, applied, advance.payment_date, note]
        );
      }

      due -= applied;
      appliedTotal += applied;
    }

    return appliedTotal;
  }

  async applyPaymentToPurchase(purchaseId, amount) {
    const purchase = await queryOne("SELECT * FROM purchases WHERE id = $1", [purchaseId]);
    if (!purchase) throw new Error("Purchase not found");

    const balanceDue = purchase.total - (purchase.amount_paid || 0);
    if (balanceDue <= 0) return 0;

    const applied = Math.min(Number(amount), balanceDue);
    const newPaid = (purchase.amount_paid || 0) + applied;
    let status = PURCHASE_PAYMENT_STATUS.PARTIAL;
    if (newPaid >= purchase.total) status = PURCHASE_PAYMENT_STATUS.PAID;

    await execute(
      `UPDATE purchases SET amount_paid = $1, payment_status = $2, updated_at = datetime('now') WHERE id = $3`,
      [newPaid, status, purchaseId]
    );

    return applied;
  }

  async getTodayTotal(date) {
    const row = await queryOne(
      `SELECT COALESCE(SUM(total), 0) as total FROM purchases
       WHERE date(created_at) = date($1)
         AND payment_status = 'paid'`,
      [date || new Date().toISOString().slice(0, 10)]
    );
    return Number(row?.total ?? 0);
  }

  async getMonthlyTotal(from, to) {
    if (from && to) {
      const row = await queryOne(
        `SELECT COALESCE(SUM(total), 0) as total FROM purchases
         WHERE date(created_at) >= date($1) AND date(created_at) <= date($2)
           AND payment_status = 'paid'`,
        [from, to]
      );
      return Number(row?.total ?? 0);
    }
    const row = await queryOne(
      `SELECT COALESCE(SUM(total), 0) as total FROM purchases
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
         AND payment_status = 'paid'`
    );
    return Number(row?.total ?? 0);
  }
}

export const purchaseService = new PurchaseService();
