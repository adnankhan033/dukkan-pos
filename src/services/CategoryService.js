import { query, queryOne, execute } from "../database/connection";
import { formatDbError } from "../utils/format";

class CategoryService {
  async getAll({ search = "" } = {}) {
    const term = search.trim();
    let sql = `
      SELECT c.*,
             COALESCE(pc.product_count, 0) AS product_count
      FROM categories c
      LEFT JOIN (
        SELECT category_id, COUNT(*) AS product_count
        FROM products
        WHERE category_id IS NOT NULL
        GROUP BY category_id
      ) pc ON pc.category_id = c.id`;

    if (term) {
      const like = `%${term}%`;
      sql += `
       WHERE c.name LIKE $1 OR COALESCE(c.description, '') LIKE $1
       ORDER BY c.name ASC`;
      return query(sql, [like]);
    }

    sql += ` ORDER BY c.name ASC`;
    return query(sql);
  }

  async getById(id) {
    return queryOne("SELECT * FROM categories WHERE id = $1", [id]);
  }

  async findByName(name, excludeId = null) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return null;
    const normalized = trimmed.toLowerCase();

    if (excludeId != null) {
      return queryOne(
        "SELECT * FROM categories WHERE lower(trim(name)) = $1 AND id != $2",
        [normalized, Number(excludeId)]
      );
    }

    return queryOne(
      "SELECT * FROM categories WHERE lower(trim(name)) = $1",
      [normalized]
    );
  }

  async create(data) {
    const name = String(data.name || "").trim();
    const description = String(data.description || "").trim();

    if (!name) {
      throw new Error("Category name is required");
    }

    const existing = await this.findByName(name);
    if (existing) {
      throw new Error(`Category "${name}" already exists`);
    }

    try {
      const rows = await query(
        `INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *`,
        [name, description || null]
      );
      const created = rows?.[0];
      if (!created?.id) {
        throw new Error("Category was not saved. Please try again.");
      }
      return { ...created, product_count: 0 };
    } catch (err) {
      const msg = formatDbError(err);
      if (/unique|already exists/i.test(msg)) {
        throw new Error(`Category "${name}" already exists`);
      }
      throw new Error(msg || "Failed to save category");
    }
  }

  async update(id, data) {
    const numId = Number(id);
    const name = String(data.name || "").trim();
    const description = String(data.description || "").trim();

    if (!name) {
      throw new Error("Category name is required");
    }

    const existing = await this.findByName(name, numId);
    if (existing) {
      throw new Error(`Category "${name}" already exists`);
    }

    try {
      await execute(
        `UPDATE categories SET name = $1, description = $2, updated_at = datetime('now')
         WHERE id = $3`,
        [name, description || null, numId]
      );

      const updated = await this.getById(numId);
      if (!updated) {
        throw new Error("Category not found");
      }

      return updated;
    } catch (err) {
      const msg = formatDbError(err);
      if (/unique|already exists/i.test(msg)) {
        throw new Error(`Category "${name}" already exists`);
      }
      throw new Error(msg || "Failed to update category");
    }
  }

  async getProductCount(id) {
    const row = await queryOne(
      "SELECT COUNT(*) AS count FROM products WHERE category_id = $1",
      [Number(id)]
    );
    return Number(row?.count ?? 0);
  }

  async delete(id, { unassignProducts = false } = {}) {
    const numId = Number(id);
    const productCount = await this.getProductCount(numId);

    if (productCount > 0 && !unassignProducts) {
      throw new Error(
        `Cannot delete — ${productCount} product(s) use this category. Confirm delete to unassign them first.`
      );
    }

    if (productCount > 0) {
      await execute(
        "UPDATE products SET category_id = NULL, updated_at = datetime('now') WHERE category_id = $1",
        [numId]
      );
    }

    await execute("DELETE FROM categories WHERE id = $1", [numId]);

    const stillExists = await queryOne("SELECT id FROM categories WHERE id = $1", [numId]);
    if (stillExists) {
      throw new Error("Failed to delete category. Please restart the app and try again.");
    }

    return { productCount };
  }

  async search(term) {
    return this.getAll({ search: term });
  }
}

export const categoryService = new CategoryService();
