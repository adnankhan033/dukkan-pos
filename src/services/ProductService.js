import { query, queryOne, execute, insert } from "../database/connection";

const LIST_COLUMNS = `
  p.id, p.name, p.name_ar, p.sku, p.barcode, p.category_id, p.unit_id,
  p.cost_price, p.selling_price, p.quantity, p.min_stock, p.published,
  p.created_at, p.updated_at,
  CASE WHEN p.image IS NOT NULL AND p.image != '' THEN 1 ELSE 0 END AS has_image,
  c.name AS category_name,
  u.name AS unit_name,
  u.symbol AS unit_symbol
`;

const PRODUCT_JOINS = `
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN units u ON p.unit_id = u.id
`;

class ProductService {
  async getAll({
    search = "",
    categoryId = null,
    published = null,
    page = 1,
    limit = 10,
  } = {}) {
    let where = "WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.name LIKE $${params.length} OR p.name_ar LIKE $${params.length} OR p.sku LIKE $${params.length} OR p.barcode LIKE $${params.length})`;
    }

    if (categoryId) {
      params.push(categoryId);
      where += ` AND p.category_id = $${params.length}`;
    }

    if (published !== null && published !== undefined) {
      params.push(published ? 1 : 0);
      where += ` AND COALESCE(p.published, 1) = $${params.length}`;
    }

    const countParams = [...params];
    const [countRow, items] = await Promise.all([
      queryOne(`SELECT COUNT(*) AS total FROM products p ${where}`, countParams),
      query(
        `SELECT ${LIST_COLUMNS}
         FROM products p
         ${PRODUCT_JOINS}
         ${where}
         ORDER BY p.name ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, (page - 1) * limit]
      ),
    ]);

    return { items, total: countRow?.total ?? 0, page, limit };
  }

  async getPosCatalog(limit = 500) {
    return query(
      `SELECT p.id, p.name, p.name_ar, p.sku, p.barcode, p.selling_price, p.cost_price, p.quantity, p.category_id,
              c.name AS category_name, u.symbol AS unit_symbol
       FROM products p
       ${PRODUCT_JOINS}
       WHERE COALESCE(p.published, 1) = 1
       ORDER BY p.name ASC
       LIMIT $1`,
      [limit]
    );
  }

  async getById(id) {
    return queryOne(
      `SELECT p.*, c.name as category_name, u.symbol AS unit_symbol
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE p.id = $1`,
      [Number(id)]
    );
  }

  async getByBarcode(barcode) {
    return queryOne(
      "SELECT * FROM products WHERE barcode = $1 AND COALESCE(published, 1) = 1",
      [barcode]
    );
  }

  async resolveUnitId(unitId) {
    if (unitId == null || unitId === "") return null;
    return Number(unitId);
  }

  async create(data) {
    const published = data.published === false || data.published === 0 ? 0 : 1;
    const unitId = await this.resolveUnitId(data.unit_id);
    const id = await insert(
      `INSERT INTO products (name, name_ar, sku, barcode, category_id, unit_id, cost_price, selling_price, quantity, min_stock, image, published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        data.name,
        data.name_ar || null,
        data.sku || null,
        data.barcode || null,
        data.category_id || null,
        unitId,
        Number(data.cost_price) || 0,
        Number(data.selling_price) || 0,
        Number(data.quantity) || 0,
        Number(data.min_stock) || 0,
        data.image || null,
        published,
      ]
    );
    if (Number(data.quantity) > 0) {
      await execute(
        `INSERT INTO inventory (product_id, quantity_change, quantity_after, reason, reference_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, Number(data.quantity), Number(data.quantity), "Initial stock", "adjustment"]
      );
    }
    return { id, ...data, published, has_image: data.image ? 1 : 0 };
  }

  async update(id, data) {
    const published = data.published === false || data.published === 0 ? 0 : 1;
    const numId = Number(id);
    const unitId = await this.resolveUnitId(data.unit_id);

    if (data.image !== undefined) {
      await execute(
        `UPDATE products SET
          name = $1, name_ar = $2, sku = $3, barcode = $4, category_id = $5, unit_id = $6,
          cost_price = $7, selling_price = $8, quantity = $9, min_stock = $10,
          published = $11, image = $12, updated_at = datetime('now')
         WHERE id = $13`,
        [
          data.name,
          data.name_ar || null,
          data.sku || null,
          data.barcode || null,
          data.category_id || null,
          unitId,
          Number(data.cost_price) || 0,
          Number(data.selling_price) || 0,
          Number(data.quantity) || 0,
          Number(data.min_stock) || 0,
          published,
          data.image || null,
          numId,
        ]
      );
    } else {
      await execute(
        `UPDATE products SET
          name = $1, name_ar = $2, sku = $3, barcode = $4, category_id = $5, unit_id = $6,
          cost_price = $7, selling_price = $8, quantity = $9, min_stock = $10,
          published = $11, updated_at = datetime('now')
         WHERE id = $12`,
        [
          data.name,
          data.name_ar || null,
          data.sku || null,
          data.barcode || null,
          data.category_id || null,
          unitId,
          Number(data.cost_price) || 0,
          Number(data.selling_price) || 0,
          Number(data.quantity) || 0,
          Number(data.min_stock) || 0,
          published,
          numId,
        ]
      );
    }
    return { id: numId, ...data, published, has_image: data.image ? 1 : 0 };
  }

  /** Remove product and all dependent rows (inventory, line items). */
  async delete(id) {
    const numId = Number(id);
    const product = await queryOne("SELECT id, name FROM products WHERE id = $1", [numId]);
    if (!product) {
      throw new Error("Product not found");
    }

    await execute("DELETE FROM inventory WHERE product_id = $1", [numId]);
    await execute("DELETE FROM sale_items WHERE product_id = $1", [numId]);
    await execute("DELETE FROM purchase_items WHERE product_id = $1", [numId]);
    await execute("DELETE FROM products WHERE id = $1", [numId]);

    const stillExists = await queryOne("SELECT id FROM products WHERE id = $1", [numId]);
    if (stillExists) {
      throw new Error(`Failed to delete "${product.name}". Please restart the app and try again.`);
    }

    return true;
  }

  async deleteMany(ids) {
    const deleted = [];
    const failed = [];

    for (const id of ids) {
      try {
        await this.delete(id);
        deleted.push(Number(id));
      } catch (err) {
        failed.push({ id: Number(id), message: err.message });
      }
    }

    return { deleted, failed };
  }

  async setPublishedMany(ids, published) {
    if (!ids.length) return { updated: 0 };
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
    await execute(
      `UPDATE products SET published = $1, updated_at = datetime('now') WHERE id IN (${placeholders})`,
      [published ? 1 : 0, ...ids.map(Number)]
    );
    return { updated: ids.length };
  }

  async count() {
    const row = await queryOne("SELECT COUNT(*) as total FROM products");
    return row?.total ?? 0;
  }

  async getLowStock() {
    return query(
      `SELECT p.*, c.name as category_name, u.symbol AS unit_symbol
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE p.quantity <= p.min_stock AND COALESCE(p.published, 1) = 1
       ORDER BY p.quantity ASC`
    );
  }

  async searchForPos(term) {
    const like = `%${term}%`;
    return query(
      `SELECT p.*, c.name as category_name, u.symbol AS unit_symbol
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE COALESCE(p.published, 1) = 1
       AND (p.name LIKE $1 OR p.name_ar LIKE $1 OR p.sku LIKE $1 OR p.barcode LIKE $1)
       ORDER BY p.name ASC LIMIT 20`,
      [like]
    );
  }
}

export const productService = new ProductService();
