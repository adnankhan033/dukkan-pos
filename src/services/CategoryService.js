import { query, queryOne, execute, insert } from "../database/connection";

class CategoryService {
  async getAll({ search = "" } = {}) {
    const term = search.trim();
    const baseSelect = `
      SELECT c.*,
             (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
      FROM categories c`;

    if (term) {
      const like = `%${term}%`;
      return query(
        `${baseSelect}
         WHERE c.name LIKE $1 OR COALESCE(c.description, '') LIKE $1
         ORDER BY c.name ASC`,
        [like]
      );
    }

    return query(`${baseSelect} ORDER BY c.name ASC`);
  }

  async getById(id) {
    return queryOne("SELECT * FROM categories WHERE id = $1", [id]);
  }

  async create(data) {
    const id = await insert(
      "INSERT INTO categories (name, description) VALUES ($1, $2)",
      [data.name, data.description || null]
    );
    return this.getById(id);
  }

  async update(id, data) {
    await execute(
      `UPDATE categories SET name = $1, description = $2, updated_at = datetime('now')
       WHERE id = $3`,
      [data.name, data.description || null, id]
    );
    return this.getById(id);
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
