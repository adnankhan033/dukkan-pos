import { query, queryOne, execute, insert } from "../database/connection";
import { inventoryService } from "./InventoryService";
import { generateNumber } from "../utils/format";

class PurchaseService {
  async getAll({ page = 1, limit = 10 } = {}) {
    let sql = `
      SELECT p.*, s.company as supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

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

  async create({ supplierId, items, notes }) {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const purchaseNumber = generateNumber("PO");

    const purchaseId = await insert(
      `INSERT INTO purchases (purchase_number, supplier_id, subtotal, total, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [purchaseNumber, supplierId || null, subtotal, subtotal, notes || null]
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
    }

    await execute(
      `INSERT INTO payments (purchase_id, amount, payment_method, notes) VALUES ($1, $2, $3, $4)`,
      [purchaseId, subtotal, "cash", "Purchase payment"]
    );

    return this.getById(purchaseId);
  }

  async getTodayTotal() {
    const row = await queryOne(
      `SELECT COALESCE(SUM(total), 0) as total FROM purchases
       WHERE date(created_at) = date('now')`
    );
    return row?.total ?? 0;
  }

  async getMonthlyTotal() {
    const row = await queryOne(
      `SELECT COALESCE(SUM(total), 0) as total FROM purchases
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    );
    return row?.total ?? 0;
  }
}

export const purchaseService = new PurchaseService();
