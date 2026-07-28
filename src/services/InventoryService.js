import { query, queryOne, execute } from "../database/connection";

class InventoryService {
  async getAll({ filter = "all" } = {}) {
    let sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    if (filter === "low") {
      sql += " AND p.quantity <= p.min_stock AND p.quantity > 0";
    } else if (filter === "out") {
      sql += " AND p.quantity <= 0";
    }

    sql += " ORDER BY p.name ASC";
    return query(sql);
  }

  async adjustStock(productId, newQuantity, reason = "Manual adjustment") {
    const product = await queryOne("SELECT * FROM products WHERE id = $1", [productId]);
    if (!product) throw new Error("Product not found");

    const change = newQuantity - product.quantity;
    await execute(
      "UPDATE products SET quantity = $1, updated_at = datetime('now') WHERE id = $2",
      [newQuantity, productId]
    );
    await execute(
      `INSERT INTO inventory (product_id, quantity_change, quantity_after, reason, reference_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, change, newQuantity, reason, "adjustment"]
    );
    return queryOne("SELECT * FROM products WHERE id = $1", [productId]);
  }

  async reduceStock(productId, quantity, referenceType, referenceId) {
    const product = await queryOne("SELECT * FROM products WHERE id = $1", [productId]);
    if (!product) throw new Error("Product not found");

    // Allow overselling — stock may go negative
    const newQty = product.quantity - quantity;
    await execute(
      "UPDATE products SET quantity = $1, updated_at = datetime('now') WHERE id = $2",
      [newQty, productId]
    );
    await execute(
      `INSERT INTO inventory (product_id, quantity_change, quantity_after, reason, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, -quantity, newQty, "Sale", referenceType, referenceId]
    );
  }

  async increaseStock(productId, quantity, referenceType, referenceId) {
    const product = await queryOne("SELECT * FROM products WHERE id = $1", [productId]);
    if (!product) throw new Error("Product not found");

    const newQty = product.quantity + quantity;
    await execute(
      "UPDATE products SET quantity = $1, updated_at = datetime('now') WHERE id = $2",
      [newQty, productId]
    );
    await execute(
      `INSERT INTO inventory (product_id, quantity_change, quantity_after, reason, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, quantity, newQty, "Purchase", referenceType, referenceId]
    );
  }

  async getHistory(productId) {
    return query(
      `SELECT * FROM inventory WHERE product_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [productId]
    );
  }
}

export const inventoryService = new InventoryService();
