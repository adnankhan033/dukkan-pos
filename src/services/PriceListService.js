import { query, queryOne, execute, insert, runInTransaction } from "../database/connection";
import { WHOLESALE_SCHEMA_STATEMENTS } from "../database/wholesaleSchema";

export const PRICE_LIST_KINDS = [
  { id: "wholesale", label: "Wholesale" },
  { id: "distributor", label: "Distributor" },
  { id: "special", label: "Special customer" },
];

export function priceListKindLabel(kind) {
  return PRICE_LIST_KINDS.find((item) => item.id === kind)?.label || "Wholesale";
}

class PriceListService {
  async ensureSchema() {
    for (const statement of WHOLESALE_SCHEMA_STATEMENTS) {
      await execute(statement);
    }
  }

  async list() {
    await this.ensureSchema();
    return query(
      `SELECT
         pl.*,
         (SELECT COUNT(*) FROM price_list_items i WHERE i.price_list_id = pl.id) AS item_count,
         (SELECT COUNT(*) FROM customer_price_lists c WHERE c.price_list_id = pl.id) AS customer_count
       FROM price_lists pl
       ORDER BY pl.is_active DESC, pl.name COLLATE NOCASE`
    );
  }

  async get(id) {
    await this.ensureSchema();
    return queryOne("SELECT * FROM price_lists WHERE id = $1", [id]);
  }

  async create({ name, kind = "wholesale", notes = "", is_default = false, is_active = true }) {
    await this.ensureSchema();
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new Error("Enter a name for this price list.");
    const existing = await queryOne(
      "SELECT id FROM price_lists WHERE lower(trim(name)) = $1",
      [trimmed.toLowerCase()]
    );
    if (existing) throw new Error(`A price list named "${trimmed}" already exists.`);

    if (is_default) {
      await execute("UPDATE price_lists SET is_default = 0");
    }
    const id = await insert(
      `INSERT INTO price_lists (name, kind, notes, is_default, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, datetime('now'))`,
      [trimmed, kind || "wholesale", String(notes || "").trim(), is_default ? 1 : 0, is_active ? 1 : 0]
    );
    return this.get(id);
  }

  async update(id, { name, kind, notes, is_default, is_active }) {
    const current = await this.get(id);
    if (!current) throw new Error("Price list not found.");
    const trimmed = String(name ?? current.name).trim();
    if (!trimmed) throw new Error("Enter a name for this price list.");

    const clash = await queryOne(
      "SELECT id FROM price_lists WHERE lower(trim(name)) = $1 AND id != $2",
      [trimmed.toLowerCase(), id]
    );
    if (clash) throw new Error(`A price list named "${trimmed}" already exists.`);

    await runInTransaction(async ({ execute: txExecute }) => {
      if (is_default) {
        await txExecute("UPDATE price_lists SET is_default = 0 WHERE id != $1", [id]);
      }
      await txExecute(
        `UPDATE price_lists
         SET name = $1, kind = $2, notes = $3, is_default = $4, is_active = $5, updated_at = datetime('now')
         WHERE id = $6`,
        [
          trimmed,
          kind || current.kind || "wholesale",
          notes == null ? current.notes || "" : String(notes).trim(),
          is_default ? 1 : 0,
          is_active === false || is_active === 0 ? 0 : 1,
          id,
        ]
      );
    });
    return this.get(id);
  }

  async remove(id) {
    await runInTransaction(async ({ execute: txExecute }) => {
      await txExecute("DELETE FROM price_list_items WHERE price_list_id = $1", [id]);
      await txExecute("DELETE FROM customer_price_lists WHERE price_list_id = $1", [id]);
      await txExecute("DELETE FROM price_lists WHERE id = $1", [id]);
    });
    return true;
  }

  async listItems(priceListId) {
    return query(
      `SELECT i.*, p.name AS product_name, p.selling_price AS retail_price, p.barcode
       FROM price_list_items i
       JOIN products p ON p.id = i.product_id
       WHERE i.price_list_id = $1
       ORDER BY p.name COLLATE NOCASE`,
      [priceListId]
    );
  }

  async addItem(priceListId, { product_id, price, min_qty = 1 }) {
    const productId = Number(product_id);
    if (!productId) throw new Error("Choose a product.");
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid wholesale price.");
    const qty = Math.max(1, Number(min_qty) || 1);

    const existing = await queryOne(
      `SELECT id FROM price_list_items
       WHERE price_list_id = $1 AND product_id = $2 AND COALESCE(product_unit_id, 0) = 0 AND min_qty = $3`,
      [priceListId, productId, qty]
    );
    if (existing) {
      await execute(
        `UPDATE price_list_items SET price = $1, updated_at = datetime('now') WHERE id = $2`,
        [amount, existing.id]
      );
      return this.listItems(priceListId);
    }

    await insert(
      `INSERT INTO price_list_items (price_list_id, product_id, min_qty, price, updated_at)
       VALUES ($1, $2, $3, $4, datetime('now'))`,
      [priceListId, productId, qty, amount]
    );
    return this.listItems(priceListId);
  }

  async updateItem(id, { price, min_qty }) {
    const patch = [];
    const params = [];
    if (price != null) {
      params.push(Number(price));
      patch.push(`price = $${params.length}`);
    }
    if (min_qty != null) {
      params.push(Math.max(1, Number(min_qty) || 1));
      patch.push(`min_qty = $${params.length}`);
    }
    if (!patch.length) return;
    params.push(id);
    await execute(
      `UPDATE price_list_items SET ${patch.join(", ")}, updated_at = datetime('now') WHERE id = $${params.length}`,
      params
    );
  }

  async removeItem(id) {
    await execute("DELETE FROM price_list_items WHERE id = $1", [id]);
  }

  async listCustomers(priceListId) {
    return query(
      `SELECT c.id, c.name, c.phone, cpl.id AS assignment_id, cpl.credit_limit
       FROM customer_price_lists cpl
       JOIN customers c ON c.id = cpl.customer_id
       WHERE cpl.price_list_id = $1
       ORDER BY c.name COLLATE NOCASE`,
      [priceListId]
    );
  }

  async assignCustomer(priceListId, customerId) {
    const id = Number(customerId);
    if (!id) throw new Error("Choose a customer.");
    const existing = await queryOne(
      "SELECT id FROM customer_price_lists WHERE customer_id = $1 AND price_list_id = $2",
      [id, priceListId]
    );
    if (existing) return this.listCustomers(priceListId);
    await insert(
      `INSERT INTO customer_price_lists (customer_id, price_list_id) VALUES ($1, $2)`,
      [id, priceListId]
    );
    return this.listCustomers(priceListId);
  }

  async unassignCustomer(assignmentId) {
    await execute("DELETE FROM customer_price_lists WHERE id = $1", [assignmentId]);
  }

  async searchProducts(term = "") {
    const params = [];
    let where = "WHERE COALESCE(published, 1) = 1";
    if (String(term || "").trim()) {
      params.push(`%${String(term).trim()}%`);
      where += ` AND (name LIKE $1 OR name_ar LIKE $1 OR sku LIKE $1 OR barcode LIKE $1)`;
    }
    return query(
      `SELECT id, name, selling_price, cost_price, barcode
       FROM products ${where}
       ORDER BY name COLLATE NOCASE
       LIMIT 80`,
      params
    );
  }

  async searchCustomers(term = "") {
    const params = [];
    let where = "WHERE 1=1";
    if (String(term || "").trim()) {
      params.push(`%${String(term).trim()}%`);
      where += ` AND (name LIKE $1 OR phone LIKE $1 OR email LIKE $1)`;
    }
    return query(
      `SELECT id, name, phone FROM customers ${where} ORDER BY name COLLATE NOCASE LIMIT 80`,
      params
    );
  }
}

export const priceListService = new PriceListService();
