import { query, queryOne, execute } from "../database/connection";
import { INVENTORY_PAGE_SIZE } from "../utils/constants";
import { invalidateInventoryCache } from "./InventoryCache";
import { invalidateDashboardCache } from "./DashboardCache";

const LIST_COLUMNS = `
  p.id, p.name, p.name_ar, p.sku, p.barcode, p.quantity, p.min_stock,
  p.cost_price, p.selling_price, p.category_id, c.name AS category_name
`;

function buildWhere(filter, search) {
  let where = "WHERE 1=1";
  const params = [];

  if (filter === "low") {
    where += " AND p.quantity <= p.min_stock AND p.quantity > 0";
  } else if (filter === "out") {
    where += " AND p.quantity <= 0";
  }

  const term = search.trim();
  if (term) {
    params.push(`%${term}%`);
    where += ` AND (p.name LIKE $${params.length} OR p.name_ar LIKE $${params.length} OR p.sku LIKE $${params.length} OR p.barcode LIKE $${params.length})`;
  }

  return { where, params };
}

function orderByForFilter(filter) {
  if (filter === "low" || filter === "out") {
    return "p.quantity ASC, p.name ASC";
  }
  return "p.name ASC";
}

class InventoryService {
  async getAll({
    filter = "all",
    page = 1,
    limit = INVENTORY_PAGE_SIZE,
    search = "",
  } = {}) {
    const { where, params } = buildWhere(filter, search);
    const countParams = [...params];
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Number(limit) || INVENTORY_PAGE_SIZE);
    const offset = (safePage - 1) * safeLimit;

    const [countRow, items] = await Promise.all([
      queryOne(`SELECT COUNT(*) AS total FROM products p ${where}`, countParams),
      query(
        `SELECT ${LIST_COLUMNS}
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${where}
         ORDER BY ${orderByForFilter(filter)}
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

  async getSummaryCounts() {
    const row = await queryOne(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN quantity <= min_stock AND quantity > 0 THEN 1 ELSE 0 END) AS low_stock,
         SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock
       FROM products`
    );

    return {
      all: Number(row?.total ?? 0),
      low: Number(row?.low_stock ?? 0),
      out: Number(row?.out_of_stock ?? 0),
    };
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

    invalidateInventoryCache();
    invalidateDashboardCache();

    return queryOne("SELECT * FROM products WHERE id = $1", [productId]);
  }

  async reduceStock(productId, quantity, referenceType, referenceId) {
    const product = await queryOne("SELECT * FROM products WHERE id = $1", [productId]);
    if (!product) throw new Error("Product not found");

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

    invalidateInventoryCache();
    invalidateDashboardCache();
  }

  async increaseStock(productId, quantity, referenceType, referenceId) {
    const product = await queryOne("SELECT * FROM products WHERE id = $1", [productId]);
    if (!product) throw new Error("Product not found");

    const newQty = product.quantity + quantity;
    const reason =
      referenceType === "return"
        ? "Return"
        : referenceType === "order_delete"
          ? "Order deleted"
          : referenceType === "invoice_update"
            ? "Invoice updated"
            : "Purchase";
    await execute(
      "UPDATE products SET quantity = $1, updated_at = datetime('now') WHERE id = $2",
      [newQty, productId]
    );
    await execute(
      `INSERT INTO inventory (product_id, quantity_change, quantity_after, reason, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, quantity, newQty, reason, referenceType, referenceId]
    );

    invalidateInventoryCache();
    invalidateDashboardCache();
  }

  async getHistory(productId) {
    return query(
      `SELECT * FROM inventory WHERE product_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [productId]
    );
  }
}

export const inventoryService = new InventoryService();
