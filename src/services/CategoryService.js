import { query, queryOne, execute, insert } from "../database/connection";

class CategoryService {
  async getAll() {
    return query("SELECT * FROM categories ORDER BY name ASC");
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

  async delete(id) {
    const products = await queryOne(
      "SELECT COUNT(*) as count FROM products WHERE category_id = $1",
      [id]
    );
    if (products?.count > 0) {
      throw new Error("Cannot delete category with assigned products");
    }
    await execute("DELETE FROM categories WHERE id = $1", [id]);
    return true;
  }

  async search(term) {
    const like = `%${term}%`;
    return query(
      "SELECT * FROM categories WHERE name LIKE $1 OR description LIKE $1 ORDER BY name ASC",
      [like]
    );
  }
}

export const categoryService = new CategoryService();
